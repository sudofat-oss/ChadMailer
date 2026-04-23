<?php

// Désactiver l'affichage des erreurs pour éviter qu'elles polluent le JSON
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// SSE bypass — doit être avant ob_start()
$_action_early = $_GET['action'] ?? '';
if ($_action_early === 'stream') {
    require_once __DIR__ . '/../vendor/autoload.php';
    $id = $_GET['id'] ?? '';
    $cm = new \ChadMailer\CampaignManager(
        new \ChadMailer\Template\TemplateManager(),
        new \ChadMailer\CSV\RecipientParser(),
        new \ChadMailer\Mailer\MailerManager(
            (new \ChadMailer\Config\ConfigManager())->get('mailer', []),
            (new \Monolog\Logger('sse'))->pushHandler(new \Monolog\Handler\NullHandler())
        ),
        (new \Monolog\Logger('sse'))->pushHandler(new \Monolog\Handler\NullHandler())
    );
    $cm->streamCampaignLogs($id);
    exit;
}

// Démarrer le buffer de sortie pour capturer toute sortie accidentelle
ob_start();

require_once __DIR__ . '/../vendor/autoload.php';

use ChadMailer\Config\ConfigManager;
use ChadMailer\Template\TemplateManager;
use ChadMailer\CSV\RecipientParser;
use ChadMailer\Mailer\MailerManager;
use ChadMailer\Mailer\SMTPConfigManager;
use ChadMailer\Mailer\SesAccountInspector;
use ChadMailer\Mailer\BrevoSendersClient;
use ChadMailer\Mailer\ProviderRemoteInspector;
use ChadMailer\Mailer\SendGridRestClient;
use Symfony\Component\HttpClient\HttpClient;
use ChadMailer\CampaignManager;
use ChadMailer\Scoring\CampaignScorer;
use ChadMailer\DNS\DnsChecker;
use Monolog\Logger;
use Monolog\Handler\StreamHandler;

/**
 * Retourne une réponse d'erreur JSON
 */
function jsonError(string $message, int $code = 500): void {
    if (ob_get_level() > 0) {
        ob_clean();
    }
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-cache, must-revalidate');
    echo json_encode([
        'success' => false,
        'error' => $message
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Retourne une réponse de succès JSON
 */
function jsonSuccess($data = null): void {
    if (ob_get_level() > 0) {
        ob_clean();
    }
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-cache, must-revalidate');
    $response = ['success' => true];
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Lance l'envoi de campagne en arrière-plan (Linux/macOS + Windows).
 */
function spawnCampaignWorker(string $phpBin, string $cliPath, string $campaignId): bool {
    // Windows: cmd /c start /B ... > NUL 2>&1
    if (DIRECTORY_SEPARATOR === '\\') {
        $cmd = sprintf(
            'cmd /c start "" /B %s %s send %s > NUL 2>&1',
            escapeshellarg($phpBin),
            escapeshellarg($cliPath),
            escapeshellarg($campaignId)
        );
        try {
            $handle = @popen($cmd, 'r');
            if ($handle === false) {
                return false;
            }
            pclose($handle);
            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    // Linux/macOS: ... > /dev/null 2>&1 &
    $cmd = sprintf(
        '%s %s send %s > /dev/null 2>&1 &',
        escapeshellcmd($phpBin),
        escapeshellarg($cliPath),
        escapeshellarg($campaignId)
    );
    exec($cmd, $out, $exitCode);

    return $exitCode === 0;
}

/**
 * Résout la cible à exécuter pour le worker:
 * - si l'app tourne en PHAR: exécuter le PHAR lui-même
 * - sinon: exécuter cli.php du projet
 */
function resolveWorkerEntrypoint(): ?string {
    $runningPhar = \Phar::running(true);
    if (\is_string($runningPhar) && $runningPhar !== '') {
        return $runningPhar;
    }

    $pharFromEnv = getenv('CHADMAILER_PHAR_PATH');
    if (\is_string($pharFromEnv) && $pharFromEnv !== '' && is_file($pharFromEnv)) {
        return $pharFromEnv;
    }

    $cliPath = __DIR__ . '/../cli.php';
    if (is_file($cliPath)) {
        $resolved = realpath($cliPath);
        return $resolved !== false ? $resolved : $cliPath;
    }

    return null;
}

try {
    // Initialisation
    $configManager = new ConfigManager();
    $logger = new Logger('chadmailer');
    
    // Utiliser un répertoire persistant pour le storage
    $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: (getenv('HOMEPATH') ?: ''));
    
    if ($homeDir) {
        $storagePath = $homeDir . '/.chadmailer/storage';
    } else {
        $storagePath = $configManager->get('paths.storage', __DIR__ . '/../storage');
    }
    
    if (!is_dir($storagePath)) {
        mkdir($storagePath, 0755, true);
    }
    $logger->pushHandler(new StreamHandler($storagePath . '/app.log', Logger::INFO));

    $mailerConfig = $configManager->get('mailer', []);
    // Ne pas initialiser le mailer immédiatement pour éviter les erreurs si les dépendances manquent
    $mailerManager = new MailerManager($mailerConfig, $logger);

    // TemplateManager utilisera automatiquement le répertoire persistant
    $templateManager = new TemplateManager();
    $recipientParser = new RecipientParser();
    $campaignManager = new CampaignManager($templateManager, $recipientParser, $mailerManager, $logger);

    // Router simple
    $action = $_GET['action'] ?? 'dashboard';
    $method = $_SERVER['REQUEST_METHOD'];

    header('Content-Type: application/json');

    switch ($action) {
        case 'dashboard':
            if ($method === 'GET') {
                $campaigns = $campaignManager->listCampaigns();
                $templates = $templateManager->listTemplates();
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'campaigns' => $campaigns,
                        'templates' => $templates
                    ]
                ]);
            }
            break;

        case 'templates':
            if ($method === 'GET') {
                jsonSuccess($templateManager->listTemplates());
            } elseif ($method === 'POST') {
                $input = file_get_contents('php://input');
                if ($input === false || $input === '') {
                    jsonError('Aucune donnée reçue', 400);
                }
                
                $data = json_decode($input, true);
                
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $logger->error("Erreur parsing JSON", [
                        'error' => json_last_error_msg(),
                        'input_length' => strlen($input),
                        'input_preview' => substr($input, 0, 200)
                    ]);
                    jsonError('Données JSON invalides: ' . json_last_error_msg(), 400);
                }
                
                if (empty($data['name']) || empty($data['subject'])) {
                    jsonError('Le nom et le sujet sont requis', 400);
                }
                
                try {
                    $templateId = $templateManager->saveTemplate($data);
                    jsonSuccess(['id' => $templateId]);
                } catch (\InvalidArgumentException $e) {
                    jsonError($e->getMessage(), 400);
                } catch (\RuntimeException $e) {
                    $logger->error("Erreur sauvegarde template", [
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);
                    jsonError('Erreur lors de la sauvegarde: ' . $e->getMessage(), 500);
                } catch (\Exception $e) {
                    $logger->error("Erreur inattendue sauvegarde template", [
                        'error' => $e->getMessage(),
                        'class' => get_class($e),
                        'trace' => $e->getTraceAsString()
                    ]);
                    jsonError('Erreur inattendue: ' . $e->getMessage(), 500);
                }
            }
            break;

        case 'template':
            if ($method === 'GET') {
                $id = $_GET['id'] ?? '';
                $template = $templateManager->getTemplate($id);
                echo json_encode([
                    'success' => $template !== null,
                    'data' => $template
                ]);
            } elseif ($method === 'DELETE') {
                $id = $_GET['id'] ?? '';
                $result = $templateManager->deleteTemplate($id);
                echo json_encode(['success' => $result]);
            }
            break;

        case 'template_folders':
            if ($method === 'GET') {
                jsonSuccess($templateManager->listFolders());
            } elseif ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                if (!\is_array($data)) {
                    jsonError('Données invalides.', 400);
                    break;
                }
                try {
                    $id = $templateManager->saveFolder($data);
                    jsonSuccess(['id' => $id]);
                } catch (\InvalidArgumentException $e) {
                    jsonError($e->getMessage(), 400);
                } catch (\Exception $e) {
                    jsonError('Erreur sauvegarde dossier : ' . $e->getMessage(), 500);
                }
            }
            break;

        case 'template_folder':
            if ($method === 'DELETE') {
                $id = $_GET['id'] ?? '';
                if ($id === '') {
                    jsonError('ID de dossier requis.', 400);
                    break;
                }
                $ok = $templateManager->deleteFolder($id);
                jsonSuccess(['deleted' => $ok]);
            }
            break;

        case 'template_move':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                if (!\is_array($data) || empty($data['template_id'])) {
                    jsonError('template_id requis.', 400);
                    break;
                }
                $folderId = $data['folder_id'] ?? null;
                if ($folderId === '' || $folderId === false) {
                    $folderId = null;
                }
                $ok = $templateManager->moveTemplateToFolder((string) $data['template_id'], $folderId === null ? null : (string) $folderId);
                if (!$ok) {
                    jsonError('Impossible de déplacer le template (introuvable ou dossier absent).', 400);
                    break;
                }
                jsonSuccess(['moved' => true]);
            }
            break;

        case 'template_folder_move':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                if (!\is_array($data) || empty($data['folder_id'])) {
                    jsonError('folder_id requis.', 400);
                    break;
                }
                $parentId = $data['parent_id'] ?? null;
                if ($parentId === '' || $parentId === false) {
                    $parentId = null;
                }
                $ok = $templateManager->moveFolderToFolder((string) $data['folder_id'], $parentId === null ? null : (string) $parentId);
                if (!$ok) {
                    jsonError('Impossible de déplacer le dossier (introuvable, cycle, ou parent absent).', 400);
                    break;
                }
                jsonSuccess(['moved' => true]);
            }
            break;

        case 'campaigns':
            if ($method === 'GET') {
                echo json_encode([
                    'success' => true,
                    'data' => $campaignManager->listCampaigns()
                ]);
            } elseif ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $campaignId = $campaignManager->createCampaign($data);
                echo json_encode([
                    'success' => true,
                    'data' => ['id' => $campaignId]
                ]);
            }
            break;

        case 'campaign':
            if ($method === 'GET') {
                $id = $_GET['id'] ?? '';
                $campaign = $campaignManager->loadCampaign($id);
                if ($campaign) {
                    // Ajouter les logs si demandé
                    if (isset($_GET['with_logs'])) {
                        // Mode incrémental : log_offset fourni → on renvoie uniquement
                        // les nouvelles lignes depuis cette position (pas de troncature
                        // à 500 qui bloquait le streaming sur les longues campagnes).
                        if (isset($_GET['log_offset']) && $_GET['log_offset'] !== '') {
                            $offset = max(0, (int) $_GET['log_offset']);
                            $slice = $campaignManager->getCampaignLogsSince($id, $offset);
                            $campaign['logs'] = $slice['lines'];
                            $campaign['logs_offset'] = $slice['offset'];
                            $campaign['logs_total'] = $slice['total'];
                        } else {
                            // Mode initial : dernières 500 lignes (comportement historique
                            // conservé), on ajoute le total pour que le front puisse
                            // initialiser son curseur de poll incrémental.
                            $campaign['logs'] = $campaignManager->getCampaignLogs($id, 500);
                            $totals = $campaignManager->getCampaignLogsSince($id, 0);
                            $campaign['logs_total'] = $totals['total'];
                            $campaign['logs_offset'] = max(0, $totals['total'] - \count($campaign['logs']));
                        }
                    }
                }
                jsonSuccess($campaign);
            } elseif ($method === 'DELETE') {
                $id = $_GET['id'] ?? '';
                if (empty($id)) {
                    jsonError('ID de campagne requis', 400);
                }
                $result = $campaignManager->deleteCampaign($id);
                if ($result) {
                    jsonSuccess(['deleted' => true]);
                } else {
                    jsonError('Campagne non trouvée ou impossible à supprimer', 404);
                }
            } elseif ($method === 'PUT') {
                $id = $_GET['id'] ?? '';
                $data = json_decode(file_get_contents('php://input'), true);
                $campaign = $campaignManager->loadCampaign($id);
                if (!$campaign) {
                    jsonError('Campagne non trouvée', 404);
                }
                
                // Mettre à jour la campagne
                if (isset($data['name'])) $campaign['name'] = $data['name'];
                if (isset($data['config']) && is_array($data['config'])) {
                    $campaign['config'] = array_merge($campaign['config'] ?? [], $data['config']);
                }
                $campaign['updated_at'] = date('Y-m-d H:i:s');
                
                // Sauvegarder (utiliser le même chemin que CampaignManager)
                $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: (getenv('HOMEPATH') ?: ''));
                
                if ($homeDir) {
                    $campaignsDir = $homeDir . '/.chadmailer/campaigns';
                } else {
                    $campaignsDir = __DIR__ . '/../campaigns';
                }
                
                if (!is_dir($campaignsDir)) {
                    mkdir($campaignsDir, 0755, true);
                }
                
                $campaignFile = $campaignsDir . '/' . $id . '.json';
                file_put_contents($campaignFile, json_encode($campaign, JSON_PRETTY_PRINT));
                
                jsonSuccess($campaign);
            }
            break;

        case 'campaign_logs':
            if ($method === 'GET') {
                $id = $_GET['id'] ?? '';
                $lines = isset($_GET['lines']) ? (int)$_GET['lines'] : 100;
                $logs = $campaignManager->getCampaignLogs($id, $lines);
                jsonSuccess(['logs' => $logs]);
            }
            break;

        case 'send':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $campaignId = $data['campaign_id'] ?? '';
                if (empty($campaignId)) { jsonError('campaign_id requis', 400); }
                $camp = $campaignManager->getCampaign($campaignId);
                if (($camp['status'] ?? '') === 'running') {
                    $startedAt = strtotime($camp['started_at'] ?? '');
                    if ($startedAt && (time() - $startedAt) > 3600) {
                        $campaignManager->markInterrupted($campaignId);
                    } else {
                        jsonError('Cette campagne est déjà en cours d\'envoi.', 409);
                    }
                }
                $phpBin = PHP_BINARY;
                $entrypoint = resolveWorkerEntrypoint();
                if ($entrypoint === null || $entrypoint === '') {
                    jsonError('Impossible de localiser le worker (cli.php/PHAR).', 500);
                }
                $spawned = spawnCampaignWorker($phpBin, $entrypoint, $campaignId);
                if (!$spawned) {
                    jsonError('Impossible de démarrer le worker en arrière-plan.', 500);
                }
                jsonSuccess(['status' => 'started', 'campaign_id' => $campaignId]);
            }
            break;

        case 'pause':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $campaignManager->pauseCampaign($data['campaign_id'] ?? '');
                jsonSuccess(['status' => 'paused']);
            }
            break;

        case 'resume':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $campaignManager->resumeCampaign($data['campaign_id'] ?? '');
                jsonSuccess(['status' => 'resumed']);
            }
            break;

        case 'stop':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $campaignManager->stopCampaign($data['campaign_id'] ?? '');
                jsonSuccess(['status' => 'stopped']);
            }
            break;

        case 'score':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $templateIds = $data['template_ids'] ?? [];
                $campaignConfig = $data['campaign'] ?? [];
                if (empty($templateIds)) { jsonError('template_ids requis', 400); }
                $templates = $templateManager->getTemplates($templateIds);
                if (empty($templates)) { jsonError('Templates introuvables', 404); }
                $template = $templateManager->ensurePlainText($templates[0]);
                $scorer = new CampaignScorer();
                $result = $scorer->score($campaignConfig, $template);
                jsonSuccess($result);
            }
            break;

        case 'dns_check':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $domain = trim($data['domain'] ?? '');
                $selector = trim($data['selector'] ?? 'mail');
                if (empty($domain)) { jsonError('domain requis', 400); }
                $checker = new DnsChecker();
                $result = $checker->check($domain, $selector);
                jsonSuccess($result);
            }
            break;

        case 'parse_recipients':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $filePath = $data['file_path'] ?? '';
                $fileType = $data['file_type'] ?? 'txt';
                $columnMapping = $data['column_mapping'] ?? null;
                if (empty($filePath) || !file_exists($filePath)) {
                    jsonError('Fichier introuvable', 404);
                }
                $recipients = $recipientParser->parse($filePath, $fileType, $columnMapping);
                $domains = $recipientParser->groupByDomain($recipients);
                $headers = null;
                if ($fileType === 'csv') {
                    try {
                        $headers = $recipientParser->peekCsvHeaders($filePath);
                    } catch (\Throwable $e) {
                        $headers = null;
                    }
                }
                jsonSuccess([
                    'domains' => $domains,
                    'total' => count($recipients),
                    'headers' => $headers,
                ]);
            }
            break;

        case 'template_preview_merge':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true) ?: [];
                $tplInput = $data['template'] ?? null;
                if (!\is_array($tplInput)) {
                    jsonError('Objet template requis (html, subject, text, rotate_urls, rotate_url_every)', 400);
                    break;
                }
                $template = [
                    'html' => (string)($tplInput['html'] ?? ''),
                    'subject' => (string)($tplInput['subject'] ?? ''),
                    'text' => (string)($tplInput['text'] ?? ''),
                    'rotate_urls' => \is_array($tplInput['rotate_urls'] ?? null) ? $tplInput['rotate_urls'] : [],
                    'rotate_url_every' => max(1, (int)($tplInput['rotate_url_every'] ?? 1)),
                ];
                $emailIndex = max(0, (int)($data['recipient_index'] ?? 0));
                $campaignId = trim((string)($data['campaign_id'] ?? ''));
                $previewConfig = $data['preview_config'] ?? null;

                $recipients = [];
                $recipient = null;

                try {
                    if ($campaignId !== '') {
                        $camp = $campaignManager->loadCampaign($campaignId);
                        if (!$camp) {
                            jsonError('Campagne introuvable', 404);
                            break;
                        }
                        $recipients = $campaignManager->buildRecipientListForPreview($camp['config']);
                    } elseif (\is_array($previewConfig) && !empty($previewConfig['file_path']) && is_file((string)$previewConfig['file_path'])) {
                        $recipients = $campaignManager->buildRecipientListForPreview($previewConfig);
                    } else {
                        $manual = $data['manual_recipient'] ?? null;
                        if (!\is_array($manual) || empty($manual['email'])) {
                            jsonError('Indiquez une campagne, une liste importée (brouillon) ou manual_recipient.email', 400);
                            break;
                        }
                        $recipient = $manual;
                    }
                } catch (\Exception $e) {
                    jsonError($e->getMessage(), 400);
                    break;
                }

                if ($recipient === null) {
                    if ($recipients === []) {
                        jsonError('Aucun destinataire (après dédup / filtres).', 400);
                        break;
                    }
                    if ($emailIndex >= \count($recipients)) {
                        $emailIndex = \count($recipients) - 1;
                    }
                    $recipient = $recipients[$emailIndex];
                } else {
                    $emailIndex = 0;
                }

                $personalData = $templateManager->mergeRecipientWithTemplateVars($recipient, $template, $emailIndex);
                $subjectOut = $templateManager->personalizeString($template['subject'], $personalData);
                $htmlOut = $templateManager->personalizeString($template['html'], $personalData);
                $textOut = $templateManager->personalizeString($template['text'], $personalData);

                jsonSuccess([
                    'subject' => $subjectOut,
                    'html' => $htmlOut,
                    'text' => $textOut,
                    'recipient_used' => $recipient,
                    'recipient_index' => $emailIndex,
                    'total_in_list' => $recipients !== [] ? \count($recipients) : 1,
                ]);
            }
            break;

        case 'retry_failed':
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $campaignId = $data['campaign_id'] ?? '';
                
                try {
                    $campaignManager->retryFailedRecipients($campaignId, function($current, $total, $recipient) {
                        // Callback de progression
                    });
                    jsonSuccess(['message' => 'Relance des emails en échec lancée']);
                } catch (\Exception $e) {
                    jsonError($e->getMessage(), 400);
                }
            }
            break;

        case 'upload':
            if ($method === 'POST' && isset($_FILES['file'])) {
                // Utiliser un répertoire persistant pour les uploads
                $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: (getenv('HOMEPATH') ?: ''));
                
                if ($homeDir) {
                    $uploadDir = $homeDir . '/.chadmailer/uploads';
                } else {
                    $uploadDir = $configManager->get('paths.uploads', __DIR__ . '/../uploads');
                }
                
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }
                
                $file = $_FILES['file'];
                $fileType = $_POST['file_type'] ?? 'csv';
                
                // Déterminer l'extension selon le type
                $extension = $fileType === 'txt' ? '.txt' : '.csv';
                $filename = uniqid('file_') . '_' . basename($file['name']);
                $filepath = $uploadDir . '/' . $filename;
                
                if (move_uploaded_file($file['tmp_name'], $filepath)) {
                    $validation = $recipientParser->validate($filepath, $fileType);
                    jsonSuccess([
                        'filepath' => $filepath,
                        'filename' => $filename,
                        'file_type' => $fileType,
                        'validation' => $validation
                    ]);
                } else {
                    jsonError('Erreur lors de l\'upload du fichier', 500);
                }
            }
            break;

        case 'smtp_configs':
            $smtpManager = new SMTPConfigManager();
            if ($method === 'GET') {
                jsonSuccess($smtpManager->listConfigs());
            } elseif ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $configId = $smtpManager->saveConfig($data);
                jsonSuccess(['id' => $configId]);
            }
            break;

        case 'smtp_config':
            $smtpManager = new SMTPConfigManager();
            if ($method === 'GET') {
                $id = $_GET['id'] ?? '';
                $config = $smtpManager->loadConfig($id);
                jsonSuccess($config);
            } elseif ($method === 'DELETE') {
                $id = $_GET['id'] ?? '';
                $result = $smtpManager->deleteConfig($id);
                jsonSuccess(['deleted' => $result]);
            }
            break;

        case 'test_smtp':
            if ($method === 'POST') {
                try {
                    $data = json_decode(file_get_contents('php://input'), true);
                    
                    // smtp_config_id non vide uniquement (isset('') est vrai en PHP et cassait le test formulaire)
                    if (!empty($data['smtp_config_id'])) {
                        $smtpConfigManager = new SMTPConfigManager();
                        $smtpConfig = $smtpConfigManager->loadConfig($data['smtp_config_id']);
                        if (!$smtpConfig) {
                            jsonError('Configuration SMTP introuvable', 404);
                            break;
                        }
                        $provider = $smtpConfig['provider'] ?? 'smtp';
                        $credentials = $smtpConfig;
                    } else {
                        $provider = strtolower(trim($data['provider'] ?? 'smtp'));
                        $credentials = $data['credentials'] ?? [];
                        if (!\is_array($credentials)) {
                            $credentials = [];
                        }
                        // Formulaire plat : api_key / host / … à la racine du JSON
                        if ($credentials === [] && isset($data['provider'])) {
                            $credentials = $data;
                            foreach (['smtp_config_id', 'from_email', 'credentials', 'id', 'name', 'created_at', 'updated_at', 'provider'] as $strip) {
                                unset($credentials[$strip]);
                            }
                        }
                        // Fusion si credentials partiels ou clés seulement à la racine (ex. api_key hors sous-objet)
                        foreach (['api_key', 'host', 'port', 'username', 'password', 'access_key', 'secret_key', 'region', 'sendgrid_region', 'encryption'] as $credKey) {
                            if (isset($data[$credKey]) && $data[$credKey] !== '' && $data[$credKey] !== null) {
                                if (!isset($credentials[$credKey]) || $credentials[$credKey] === '' || $credentials[$credKey] === null) {
                                    $credentials[$credKey] = $data[$credKey];
                                }
                            }
                        }
                    }
                    
                    $fromEmail = $data['from_email'] ?? 'test@example.com';
                    
                    // Pour Brevo, récupérer les infos du compte via l'API
                    if ($provider === 'brevo') {
                        $apiKey = $credentials['api_key'] ?? '';
                        if (empty($apiKey)) {
                            jsonError('Clé API Brevo requise', 400);
                            break;
                        }
                        
                        // Appel à l'API Brevo pour récupérer les infos du compte
                        $ch = curl_init();
                        curl_setopt_array($ch, [
                            CURLOPT_URL => 'https://api.brevo.com/v3/account',
                            CURLOPT_RETURNTRANSFER => true,
                            CURLOPT_HTTPHEADER => [
                                'accept: application/json',
                                'api-key: ' . $apiKey
                            ],
                            CURLOPT_TIMEOUT => 10
                        ]);
                        
                        $response = curl_exec($ch);
                        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                        $curlError = curl_error($ch);
                        // curl_close() n'est plus nécessaire depuis PHP 8.0
                        
                        if ($curlError) {
                            jsonError('Erreur de connexion à Brevo: ' . $curlError, 500);
                            break;
                        }
                        
                        if ($httpCode !== 200) {
                            $errorData = json_decode($response, true);
                            $errorMsg = $errorData['message'] ?? 'Erreur API Brevo (code ' . $httpCode . ')';
                            jsonError($errorMsg, $httpCode);
                            break;
                        }
                        
                        $accountInfo = json_decode($response, true);
                        
                        // Extraire les infos pertinentes
                        $brevoInfo = [
                            'message' => 'Connexion réussie',
                            'provider' => 'brevo',
                            'account' => [
                                'email' => $accountInfo['email'] ?? null,
                                'company' => $accountInfo['companyName'] ?? null,
                                'plan' => []
                            ]
                        ];
                        
                        // Infos sur les crédits email
                        if (isset($accountInfo['plan'])) {
                            foreach ($accountInfo['plan'] as $plan) {
                                if ($plan['type'] === 'payAsYouGo') {
                                    $brevoInfo['account']['plan']['type'] = 'Pay as you go';
                                    $brevoInfo['account']['plan']['credits'] = $plan['credits'] ?? 0;
                                } elseif ($plan['type'] === 'free') {
                                    $brevoInfo['account']['plan']['type'] = 'Gratuit';
                                    $brevoInfo['account']['plan']['credits'] = $plan['credits'] ?? 0;
                                    if (isset($plan['creditsType'])) {
                                        $brevoInfo['account']['plan']['credits_type'] = $plan['creditsType'];
                                    }
                                } elseif (in_array($plan['type'], ['lite', 'premium', 'enterprise'])) {
                                    $brevoInfo['account']['plan']['type'] = ucfirst($plan['type']);
                                    if (isset($plan['credits'])) {
                                        $brevoInfo['account']['plan']['credits'] = $plan['credits'];
                                    }
                                }
                            }
                        }
                        
                        // Crédits marketing (emails/mois)
                        if (isset($accountInfo['marketingAutomation'])) {
                            $brevoInfo['account']['marketing_automation'] = $accountInfo['marketingAutomation']['key'] ?? null;
                        }
                        
                        // Quota relay
                        if (isset($accountInfo['relay'])) {
                            $brevoInfo['account']['relay'] = [
                                'enabled' => $accountInfo['relay']['enabled'] ?? false,
                                'data' => $accountInfo['relay']['data'] ?? null
                            ];
                        }
                        
                        jsonSuccess($brevoInfo);
                        break;
                    }
                    
                    // Pour les autres providers, test de connexion classique
                    $mailerConfig = [
                        'provider' => $provider,
                        'credentials' => $credentials,
                        'from_email' => $fromEmail
                    ];
                    
                    $logger->info("Test SMTP", ['provider' => $provider, 'credentials' => array_keys($credentials)]);
                    
                    $testMailer = new MailerManager($mailerConfig, $logger);
                    $result = $testMailer->testConnection();
                    
                    if ($result) {
                        jsonSuccess(['message' => 'Connexion réussie', 'provider' => $provider]);
                    } else {
                        // Vérifier les logs pour l'erreur exacte
                        jsonError('Échec de la connexion - Vérifiez les logs pour plus de détails', 400);
                    }
                } catch (\Exception $e) {
                    $logger->error("Erreur test SMTP", ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
                    jsonError($e->getMessage(), 500);
                }
            }
            break;

        case 'ses_inspect':
            if ($method !== 'POST') {
                break;
            }
            try {
                $data = json_decode(file_get_contents('php://input'), true) ?: [];
                if (!empty($data['smtp_config_id'])) {
                    $smtpConfigManager = new SMTPConfigManager();
                    $smtpConfig = $smtpConfigManager->loadConfig($data['smtp_config_id']);
                    if (!$smtpConfig) {
                        jsonError('Configuration SMTP introuvable', 404);
                        break;
                    }
                    $provider = strtolower((string)($smtpConfig['provider'] ?? ''));
                    $credentials = $smtpConfig;
                } else {
                    $provider = strtolower(trim((string)($data['provider'] ?? '')));
                    $credentials = $data['credentials'] ?? [];
                    if (!\is_array($credentials)) {
                        $credentials = [];
                    }
                    if ($credentials === [] && isset($data['provider'])) {
                        $credentials = $data;
                        foreach (['smtp_config_id', 'from_email', 'credentials', 'id', 'name', 'created_at', 'updated_at', 'provider', 'probe_all_regions', 'preferred_region'] as $strip) {
                            unset($credentials[$strip]);
                        }
                    }
                    foreach (['api_key', 'host', 'port', 'username', 'password', 'access_key', 'secret_key', 'region'] as $credKey) {
                        if (isset($data[$credKey]) && $data[$credKey] !== '' && $data[$credKey] !== null) {
                            if (!isset($credentials[$credKey]) || $credentials[$credKey] === '' || $credentials[$credKey] === null) {
                                $credentials[$credKey] = $data[$credKey];
                            }
                        }
                    }
                }
                if ($provider !== 'ses' && $provider !== 'amazonses') {
                    jsonError('Cette action est réservée à Amazon SES.', 400);
                    break;
                }
                $access = trim((string)($credentials['access_key'] ?? ''));
                $secret = trim((string)($credentials['secret_key'] ?? ''));
                if ($access === '') {
                    $ak = trim((string)($credentials['api_key'] ?? ''));
                    if (str_starts_with($ak, 'AKIA')) {
                        $access = $ak;
                    }
                }
                if ($secret === '') {
                    $secret = trim((string)($credentials['password'] ?? ''));
                }
                $region = trim((string)($credentials['region'] ?? ''));
                if ($region === '') {
                    $region = 'eu-west-3';
                }
                if ($access === '' || $secret === '') {
                    jsonError(
                        'Pour interroger l’API Amazon SES, il faut l’Access Key ID (AKIA…) et la Secret Access Key. '
                        . 'AWS ne permet aucun appel authentifié avec seule la partie visible : la signature exige la clé secrète.',
                        400
                    );
                    break;
                }
                $probeAll = !empty($data['probe_all_regions']);
                $preferredFromClient = trim((string)($data['preferred_region'] ?? ''));
                $inspector = new SesAccountInspector();
                if ($probeAll) {
                    $preferred = $preferredFromClient !== '' ? $preferredFromClient : null;
                    $result = $inspector->probeAllRegions($access, $secret, $preferred);
                } else {
                    $result = $inspector->fetchDetails($access, $secret, $region);
                }
                jsonSuccess($result);
            } catch (\Throwable $e) {
                $logger->error('ses_inspect', ['error' => $e->getMessage()]);
                jsonError($e->getMessage(), 500);
            }
            break;

        case 'verified_senders':
            if ($method !== 'POST') {
                break;
            }
            try {
                $data = json_decode(file_get_contents('php://input'), true) ?: [];
                if (!empty($data['smtp_config_id'])) {
                    $smtpConfigManager = new SMTPConfigManager();
                    $smtpConfig = $smtpConfigManager->loadConfig($data['smtp_config_id']);
                    if (!$smtpConfig) {
                        jsonError('Configuration SMTP introuvable', 404);
                        break;
                    }
                    $provider = strtolower((string) ($smtpConfig['provider'] ?? ''));
                    $credentials = $smtpConfig;
                } else {
                    $provider = strtolower(trim((string) ($data['provider'] ?? '')));
                    $credentials = $data['credentials'] ?? [];
                    if (!\is_array($credentials)) {
                        $credentials = [];
                    }
                    if ($credentials === [] && isset($data['provider'])) {
                        $credentials = $data;
                        foreach (['smtp_config_id', 'from_email', 'credentials', 'id', 'name', 'created_at', 'updated_at', 'provider'] as $strip) {
                            unset($credentials[$strip]);
                        }
                    }
                    foreach (['api_key', 'host', 'port', 'username', 'password', 'access_key', 'secret_key', 'region', 'sendgrid_region'] as $credKey) {
                        if (isset($data[$credKey]) && $data[$credKey] !== '' && $data[$credKey] !== null) {
                            if (!isset($credentials[$credKey]) || $credentials[$credKey] === '' || $credentials[$credKey] === null) {
                                $credentials[$credKey] = $data[$credKey];
                            }
                        }
                    }
                }

                if ($provider === 'brevo') {
                    $apiKey = trim((string) ($credentials['api_key'] ?? ''));
                    if ($apiKey === '') {
                        jsonError('Clé API Brevo requise pour lister les expéditeurs.', 400);
                        break;
                    }
                    $client = new BrevoSendersClient();
                    $senders = $client->listVerifiedSenders($apiKey);
                    jsonSuccess(['provider' => 'brevo', 'senders' => $senders]);
                    break;
                }

                if ($provider === 'ses' || $provider === 'amazonses') {
                    $access = trim((string) ($credentials['access_key'] ?? ''));
                    $secret = trim((string) ($credentials['secret_key'] ?? ''));
                    if ($access === '') {
                        $ak = trim((string) ($credentials['api_key'] ?? ''));
                        if (str_starts_with($ak, 'AKIA')) {
                            $access = $ak;
                        }
                    }
                    if ($secret === '') {
                        $secret = trim((string) ($credentials['password'] ?? ''));
                    }
                    $region = trim((string) ($credentials['region'] ?? ''));
                    if ($region === '') {
                        $region = 'eu-west-3';
                    }
                    if ($access === '' || $secret === '') {
                        jsonError(
                            'Pour lister les identités Amazon SES, il faut l’Access Key ID et la Secret Access Key.',
                            400
                        );
                        break;
                    }
                    $inspector = new SesAccountInspector();
                    $senders = $inspector->listVerifiedFromOptions($access, $secret, $region);
                    jsonSuccess(['provider' => 'ses', 'senders' => $senders]);
                    break;
                }

                if ($provider === 'sendgrid') {
                    $apiKey = SendGridRestClient::normalizeApiKey(trim((string) ($credentials['api_key'] ?? '')));
                    if ($apiKey === '') {
                        jsonError('Clé API SendGrid requise pour lister les identités expéditeur.', 400);
                        break;
                    }
                    $regionHint = SendGridRestClient::normalizeRegionHint(trim((string) ($credentials['sendgrid_region'] ?? '')));
                    $sgClient = new SendGridRestClient(
                        HttpClient::create(['timeout' => 22, 'max_duration' => 40]),
                        $regionHint
                    );
                    $locked = null;
                    $vs = $sgClient->get('/v3/verified_senders?limit=200', $apiKey, $locked);
                    if (!$vs['ok']) {
                        jsonError($vs['error'] ?? 'SendGrid : impossible de lister les expéditeurs vérifiés.', 400);
                        break;
                    }
                    $list = SendGridRestClient::parseVerifiedSendersResponse(\is_array($vs['data']) ? $vs['data'] : null);
                    jsonSuccess(['provider' => 'sendgrid', 'senders' => $list]);
                    break;
                }

                jsonError('Liste d’expéditeurs disponible pour Brevo, Amazon SES et SendGrid uniquement.', 400);
            } catch (\Throwable $e) {
                $logger->error('verified_senders', ['error' => $e->getMessage()]);
                jsonError($e->getMessage(), 500);
            }
            break;

        case 'provider_inspect':
            if ($method !== 'POST') {
                break;
            }
            try {
                $data = json_decode(file_get_contents('php://input'), true) ?: [];
                $smtpConfig = null;
                if (!empty($data['smtp_config_id'])) {
                    $smtpConfigManager = new SMTPConfigManager();
                    $smtpConfig = $smtpConfigManager->loadConfig($data['smtp_config_id']);
                    if (!$smtpConfig) {
                        jsonError('Configuration SMTP introuvable', 404);
                        break;
                    }
                    $provider = strtolower((string) ($smtpConfig['provider'] ?? ''));
                    $credentials = $smtpConfig;
                } else {
                    $provider = strtolower(trim((string) ($data['provider'] ?? '')));
                    $credentials = $data['credentials'] ?? [];
                    if (!\is_array($credentials)) {
                        $credentials = [];
                    }
                    if ($credentials === [] && isset($data['provider'])) {
                        $credentials = $data;
                        foreach (['smtp_config_id', 'from_email', 'credentials', 'id', 'name', 'created_at', 'updated_at', 'provider'] as $strip) {
                            unset($credentials[$strip]);
                        }
                    }
                    foreach (['api_key', 'host', 'port', 'username', 'password', 'access_key', 'secret_key', 'region', 'sendgrid_region'] as $credKey) {
                        if (isset($data[$credKey]) && $data[$credKey] !== '' && $data[$credKey] !== null) {
                            if (!isset($credentials[$credKey]) || $credentials[$credKey] === '' || $credentials[$credKey] === null) {
                                $credentials[$credKey] = $data[$credKey];
                            }
                        }
                    }
                }

                $inspector = new ProviderRemoteInspector();
                $fetchedAt = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format(\DateTimeInterface::ATOM);

                $remoteSnapshotForResponse = null;
                $persistSmtpSnapshotIfSaved = static function (?string $smtpId, array $fullConfigRow) use ($logger, &$remoteSnapshotForResponse): void {
                    if ($smtpId === null || $smtpId === '') {
                        return;
                    }
                    try {
                        $scm = new \ChadMailer\Mailer\SMTPConfigManager();
                        $snap = (new \ChadMailer\Mailer\SmtpRemoteSnapshotBuilder())->build($fullConfigRow);
                        if ($snap !== null) {
                            $remoteSnapshotForResponse = $snap;
                            $scm->writeRemoteSnapshot($smtpId, $snap);
                        }
                    } catch (\Throwable $e) {
                        $logger->warning('provider_inspect snapshot persist', ['error' => $e->getMessage()]);
                    }
                };

                if ($provider === 'brevo') {
                    $apiKey = trim((string) ($credentials['api_key'] ?? ''));
                    if ($apiKey === '') {
                        jsonError('Clé API Brevo requise.', 400);
                        break;
                    }
                    $payload = $inspector->inspectBrevo($apiKey);
                    if (!empty($data['smtp_config_id']) && isset($smtpConfig)) {
                        $persistSmtpSnapshotIfSaved((string) $data['smtp_config_id'], $smtpConfig);
                    }
                    jsonSuccess([
                        'fetched_at' => $fetchedAt,
                        'smtp_config_id' => $data['smtp_config_id'] ?? null,
                        'inspect' => $payload,
                        'remote_snapshot' => $remoteSnapshotForResponse,
                    ]);
                    break;
                }

                if ($provider === 'ses' || $provider === 'amazonses') {
                    $access = trim((string) ($credentials['access_key'] ?? ''));
                    $secret = trim((string) ($credentials['secret_key'] ?? ''));
                    if ($access === '') {
                        $ak = trim((string) ($credentials['api_key'] ?? ''));
                        if (str_starts_with($ak, 'AKIA')) {
                            $access = $ak;
                        }
                    }
                    if ($secret === '') {
                        $secret = trim((string) ($credentials['password'] ?? ''));
                    }
                    $region = trim((string) ($credentials['region'] ?? ''));
                    if ($region === '') {
                        $region = 'eu-west-3';
                    }
                    if ($access === '' || $secret === '') {
                        jsonError('Amazon SES : Access Key ID et Secret Access Key requis pour l’inspection API.', 400);
                        break;
                    }
                    $payload = $inspector->inspectSes($access, $secret, $region);
                    if (!empty($data['smtp_config_id']) && isset($smtpConfig)) {
                        $persistSmtpSnapshotIfSaved((string) $data['smtp_config_id'], $smtpConfig);
                    }
                    jsonSuccess([
                        'fetched_at' => $fetchedAt,
                        'smtp_config_id' => $data['smtp_config_id'] ?? null,
                        'inspect' => $payload,
                        'remote_snapshot' => $remoteSnapshotForResponse,
                    ]);
                    break;
                }

                if ($provider === 'sendgrid') {
                    $apiKey = trim((string) ($credentials['api_key'] ?? ''));
                    if ($apiKey === '') {
                        jsonError('Clé API SendGrid requise.', 400);
                        break;
                    }
                    $sgRegion = trim((string) ($credentials['sendgrid_region'] ?? ''));
                    $payload = $inspector->inspectSendGrid($apiKey, $sgRegion !== '' ? $sgRegion : null);
                    if (!empty($data['smtp_config_id']) && isset($smtpConfig)) {
                        $persistSmtpSnapshotIfSaved((string) $data['smtp_config_id'], $smtpConfig);
                    }
                    jsonSuccess([
                        'fetched_at' => $fetchedAt,
                        'smtp_config_id' => $data['smtp_config_id'] ?? null,
                        'inspect' => $payload,
                        'remote_snapshot' => $remoteSnapshotForResponse,
                    ]);
                    break;
                }

                jsonError('Inspection API disponible pour Brevo, Amazon SES et SendGrid uniquement.', 400);
            } catch (\Throwable $e) {
                $logger->error('provider_inspect', ['error' => $e->getMessage()]);
                jsonError($e->getMessage(), 500);
            }
            break;

        case 'sendgrid_activity':
            // Journal des derniers envois SendGrid (Email Activity Feed API).
            // Endpoint officiel : GET https://api.sendgrid.com/v3/messages?limit=N[&query=...]
            // Nécessite l'add-on payant "Email Activity History" : en son absence,
            // SendGrid répond 401/403/404 et on surface le message tel quel.
            if ($method !== 'POST') {
                break;
            }
            try {
                $data = json_decode(file_get_contents('php://input'), true) ?: [];
                $apiKey = '';
                $sgRegion = '';

                if (!empty($data['smtp_config_id'])) {
                    $smtpConfigManager = new SMTPConfigManager();
                    $cfg = $smtpConfigManager->loadConfig((string) $data['smtp_config_id']);
                    if (!$cfg) {
                        jsonError('Configuration SMTP introuvable', 404);
                        break;
                    }
                    if (strtolower((string) ($cfg['provider'] ?? '')) !== 'sendgrid') {
                        jsonError('Cette configuration n’est pas une configuration SendGrid.', 400);
                        break;
                    }
                    $apiKey = (string) ($cfg['api_key'] ?? $cfg['password'] ?? '');
                    $sgRegion = (string) ($cfg['sendgrid_region'] ?? '');
                } else {
                    $apiKey = (string) ($data['api_key'] ?? '');
                    $sgRegion = (string) ($data['sendgrid_region'] ?? '');
                }

                $apiKey = SendGridRestClient::normalizeApiKey($apiKey);
                if ($apiKey === '') {
                    jsonError('Clé API SendGrid requise.', 400);
                    break;
                }

                $limit = (int) ($data['limit'] ?? 25);
                if ($limit < 1) { $limit = 1; }
                if ($limit > 200) { $limit = 200; }

                // Filtres optionnels (statut / destinataire).
                $statusFilter = trim((string) ($data['status'] ?? ''));
                $toFilter = trim((string) ($data['to_email'] ?? ''));
                $queryParts = [];
                if (\in_array($statusFilter, ['delivered', 'not_delivered', 'processing', 'processed'], true)) {
                    $queryParts[] = 'status="' . $statusFilter . '"';
                }
                if ($toFilter !== '' && str_contains($toFilter, '@')) {
                    $queryParts[] = 'to_email="' . $toFilter . '"';
                }
                $qs = 'limit=' . $limit;
                if ($queryParts !== []) {
                    $qs .= '&query=' . rawurlencode(implode(' AND ', $queryParts));
                }

                $regionHint = SendGridRestClient::normalizeRegionHint($sgRegion !== '' ? $sgRegion : null);
                $sgClient = new SendGridRestClient(
                    HttpClient::create(['timeout' => 22, 'max_duration' => 40]),
                    $regionHint
                );
                $locked = null;
                $resp = $sgClient->get('/v3/messages?' . $qs, $apiKey, $locked);
                if (!$resp['ok']) {
                    // Messages courants :
                    //  - 401 : clé API invalide/expirée.
                    //  - 403 « Missing Scope » : soit la clé API n'a PAS la permission
                    //    « Email Activity Read », soit l'add-on payant « Email Activity
                    //    History » n'est pas souscrit sur le compte SendGrid.
                    //  - 404 : idem, absence d'add-on selon certaines régions.
                    $status = $resp['status'] ?? null;
                    $hint = '';
                    if ($status === 401) {
                        $hint = ' — clé API invalide ou expirée.';
                    } elseif ($status === 403) {
                        $hint = ' — la clé API n’a pas la permission « Email Activity Read » '
                            . '(Settings → API Keys → editer la clé → cocher « Email Activity » / «Read Access»), '
                            . 'ou le compte ne possède pas l’add-on payant « Email Activity History » '
                            . '(Settings → Account Details → Your Products, ~5 $/mois).';
                    } elseif ($status === 404) {
                        $hint = ' — l’add-on payant « Email Activity History » est requis pour accéder à /v3/messages.';
                    }
                    jsonError(($resp['error'] ?? 'SendGrid : erreur inconnue.') . $hint, 400);
                    break;
                }

                $messages = SendGridRestClient::parseMessagesResponse(\is_array($resp['data']) ? $resp['data'] : null);
                jsonSuccess([
                    'provider' => 'sendgrid',
                    'base_used' => $resp['base_used'] ?? null,
                    'count' => \count($messages),
                    'limit' => $limit,
                    'messages' => $messages,
                    'fetched_at' => (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format(\DateTimeInterface::ATOM),
                ]);
            } catch (\Throwable $e) {
                $logger->error('sendgrid_activity', ['error' => $e->getMessage()]);
                jsonError($e->getMessage(), 500);
            }
            break;

        case 'send_test_email':
            if ($method === 'POST') {
                try {
                    $data = json_decode(file_get_contents('php://input'), true);
                    
                    if (empty($data['smtp_config_id'])) {
                        jsonError('Configuration SMTP requise', 400);
                        break;
                    }
                    
                    $smtpConfigManager = new SMTPConfigManager();
                    $smtpConfig = $smtpConfigManager->loadConfig($data['smtp_config_id']);
                    if (!$smtpConfig) {
                        jsonError('Configuration SMTP introuvable', 404);
                        break;
                    }
                    
                    $fromEmail = !empty($data['from_email']) ? $data['from_email'] : 'test@example.com';
                    $fromName = $data['from_name'] ?? '';
                    $toEmail = $data['to'] ?? '';
                    
                    if (empty($toEmail)) {
                        jsonError('Email destinataire requis', 400);
                        break;
                    }
                    
                    // Créer le mailer avec la config SMTP
                    $mailerConfig = [
                        'provider' => $smtpConfig['provider'] ?? 'smtp',
                        'credentials' => $smtpConfig,
                        'from_email' => $fromEmail,
                        'from_name' => $fromName
                    ];
                    
                    $testMailer = new MailerManager($mailerConfig, $logger);
                    
                    // Créer l'email avec Symfony Mime
                    $email = new \Symfony\Component\Mime\Email();
                    
                    // From
                    if (!empty($fromName)) {
                        $email->from(new \Symfony\Component\Mime\Address($fromEmail, $fromName));
                    } else {
                        $email->from($fromEmail);
                    }
                    
                    // To
                    $email->to($toEmail);
                    
                    // Utiliser un template ou un message personnalisé
                    if (!empty($data['template_id'])) {
                        $template = $templateManager->getTemplate($data['template_id']);
                        if (!$template) {
                            jsonError('Template introuvable', 404);
                            break;
                        }
                        
                        // Personnaliser le template avec des données de test (+ liens rotatifs comme en campagne, index 0)
                        $testRecipient = $templateManager->mergeRecipientWithTemplateVars([
                            'email' => $toEmail,
                            'name' => 'Test',
                            'first_name' => 'Test',
                            'full_name' => 'Test User',
                        ], $template, 0);

                        $email->subject($templateManager->personalizeString($template['subject'], $testRecipient));

                        $emailContent = $templateManager->personalize($template, $testRecipient);
                        if (!empty($emailContent['html'])) {
                            $email->html($emailContent['html']);
                        }
                        if (!empty($emailContent['text'])) {
                            $email->text($emailContent['text']);
                        }
                    } else {
                        $subject = $data['subject'] ?? 'Email de test ChadMailer';
                        $textBody = isset($data['body']) ? (string) $data['body'] : '';
                        $htmlBody = isset($data['body_html']) ? (string) $data['body_html'] : '';

                        $email->subject($subject);
                        if ($htmlBody !== '') {
                            $email->html($htmlBody);
                        }
                        if ($textBody !== '') {
                            $email->text($textBody);
                        }
                        if ($htmlBody === '' && $textBody === '') {
                            $email->text('Ceci est un email de test.');
                        }
                    }
                    
                    // Envoyer l'email
                    $testMailer->send($email);
                    
                    jsonSuccess(['message' => 'Email de test envoyé avec succès']);
                } catch (\Exception $e) {
                    jsonError($e->getMessage(), 500);
                }
            }
            break;

        default:
            jsonError('Action non trouvée', 404);
        }
} catch (\Exception $e) {
    // Logger l'erreur
    if (isset($logger)) {
        $logger->error("Erreur non gérée", [
            'error' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]);
    }
    jsonError('Erreur serveur: ' . $e->getMessage(), 500);
} catch (\Error $e) {
    // Logger les erreurs fatales
    if (isset($logger)) {
        $logger->error("Erreur fatale", [
            'error' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => $e->getTraceAsString()
        ]);
    }
    jsonError('Erreur fatale: ' . $e->getMessage(), 500);
}

// Nettoyer le buffer de sortie à la fin
if (ob_get_level() > 0) {
    ob_end_flush();
}

