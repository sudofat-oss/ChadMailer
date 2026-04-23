<?php

namespace ChadMailer;

use ChadMailer\Template\TemplateManager;
use ChadMailer\CSV\RecipientParser;
use ChadMailer\Mailer\MailerManager;
use Monolog\Logger;

class CampaignManager
{
    private TemplateManager $templateManager;
    private RecipientParser $recipientParser;
    private MailerManager $mailerManager;
    private Logger $logger;
    private array $campaigns = [];
    private string $storageDir;

    public function __construct(
        TemplateManager $templateManager,
        RecipientParser $recipientParser,
        MailerManager $mailerManager,
        Logger $logger
    ) {
        $this->templateManager = $templateManager;
        $this->recipientParser = $recipientParser;
        $this->mailerManager = $mailerManager;
        $this->logger = $logger;
        $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: '');
        $this->storageDir = $homeDir
            ? $homeDir . '/.chadmailer/storage/campaigns'
            : __DIR__ . '/../../storage/campaigns';
        if (!is_dir($this->storageDir)) {
            mkdir($this->storageDir, 0755, true);
        }
    }

    /**
     * Dédouble la config si ancien bug d’API : tout le POST { name, config:{...} } avait été stocké dans config.
     */
    private function unwrapCampaignConfig(array $config): array
    {
        $hasOuterFile = isset($config['file_path']) && $config['file_path'] !== '';
        if ($hasOuterFile) {
            return $config;
        }
        if (isset($config['config']) && \is_array($config['config'])) {
            $inner = $config['config'];
            if (isset($inner['file_path']) || isset($inner['template_ids']) || isset($inner['smtp_config_id'])) {
                return $inner;
            }
        }

        return $config;
    }

    /**
     * Par défaut : une seule entrée par adresse (insensible à la casse).
     * Si désactivé, l’ordre du fichier est conservé et la même adresse peut apparaître plusieurs fois (ex. seed inbox).
     */
    private function shouldDeduplicateRecipients(array $config): bool
    {
        if (!\array_key_exists('deduplicate_recipients', $config)) {
            return true;
        }
        $v = $config['deduplicate_recipients'];
        if ($v === false || $v === 0 || $v === '0') {
            return false;
        }
        if (\is_string($v) && strtolower(trim($v)) === 'false') {
            return false;
        }

        return (bool) $v;
    }

    /**
     * Plage de délai entre e-mails en secondes (décimales autorisées, ex. 0.2–0.7).
     *
     * @return array{0: float, 1: float}
     */
    private function normalizeCampaignDelayRange(array $config): array
    {
        $legacy = $config['delay_between_emails'] ?? null;
        $fallback = ($legacy !== null && $legacy !== '') ? (float) $legacy : 1.0;
        $delayMin = max(0.0, (float) ($config['delay_min'] ?? $fallback));
        $maxRaw = $config['delay_max'] ?? null;
        if ($maxRaw === null || $maxRaw === '') {
            $delayMax = $delayMin > 0.0 ? $delayMin * 2.0 : 3.0;
        } else {
            $delayMax = (float) $maxRaw;
        }
        if ($delayMax < $delayMin) {
            $delayMax = $delayMin;
        }

        return [$delayMin, $delayMax];
    }

    /**
     * Pause aléatoire uniforme entre min et max secondes (résolution microseconde via usleep).
     */
    private function sleepRandomInterEmailDelay(float $delayMin, float $delayMax): void
    {
        $seconds = $this->computeRandomInterEmailDelaySeconds($delayMin, $delayMax);
        if ($seconds <= 0.0) {
            return;
        }
        $micros = (int) \round($seconds * 1_000_000);
        if ($micros < 1) {
            return;
        }
        $micros = \min($micros, 300_000_000);

        \usleep($micros);
    }

    private function computeRandomInterEmailDelaySeconds(float $delayMin, float $delayMax): float
    {
        if ($delayMax <= 0.0) {
            return 0.0;
        }
        $lo = max(0.0, $delayMin);
        $hi = max($lo, $delayMax);
        $span = $hi - $lo;
        $rm = \mt_getrandmax();
        $u = $rm > 0 ? \mt_rand() / $rm : 0.5;

        return $lo + $u * $span;
    }

    private function mixedToBool($value, bool $default = false): bool
    {
        if ($value === null) {
            return $default;
        }
        if (\is_bool($value)) {
            return $value;
        }
        if (\is_int($value) || \is_float($value)) {
            return ((int) $value) !== 0;
        }
        if (\is_string($value)) {
            $v = \strtolower(\trim($value));
            if ($v === '') {
                return $default;
            }
            if (\in_array($v, ['1', 'true', 'yes', 'on'], true)) {
                return true;
            }
            if (\in_array($v, ['0', 'false', 'no', 'off'], true)) {
                return false;
            }
        }

        return (bool) $value;
    }

    /**
     * @return array{from_email: string, from_name: ?string}
     */
    private function resolveSenderForSmtp(array $config, string $smtpId, array $smtpConfig = []): array
    {
        $globalFromEmail = \trim((string) ($config['from_email'] ?? ''));
        $globalFromName = \trim((string) ($config['from_name'] ?? ''));
        $resolvedFromEmail = $globalFromEmail;
        $resolvedFromName = ($globalFromName !== '') ? $globalFromName : null;

        $senderMode = (($config['smtp_sender_mode'] ?? 'default') === 'per_smtp') ? 'per_smtp' : 'default';
        $nameMode = (($config['smtp_from_name_mode'] ?? 'global') === 'per_smtp') ? 'per_smtp' : 'global';
        $perSmtp = (isset($config['smtp_per_smtp']) && \is_array($config['smtp_per_smtp'])) ? $config['smtp_per_smtp'] : [];
        $row = (isset($perSmtp[$smtpId]) && \is_array($perSmtp[$smtpId])) ? $perSmtp[$smtpId] : null;

        if ($senderMode === 'per_smtp' && $row !== null) {
            $useDefaultFrom = $this->mixedToBool($row['use_default_from'] ?? true, true);
            $customFromEmail = \trim((string) ($row['from_email'] ?? ''));
            if (!$useDefaultFrom && $customFromEmail !== '') {
                $resolvedFromEmail = $customFromEmail;
            }
        }

        if ($nameMode === 'per_smtp' && $row !== null) {
            $useGlobalName = $this->mixedToBool($row['use_global_name'] ?? true, true);
            $customFromName = \trim((string) ($row['from_name'] ?? ''));
            if (!$useGlobalName) {
                $resolvedFromName = $customFromName !== '' ? $customFromName : null;
            }
        }

        if ($resolvedFromEmail === '') {
            $provider = \strtolower(\trim((string) ($smtpConfig['provider'] ?? '')));
            if ($provider === 'smtp' || $provider === 'office365') {
                $resolvedFromEmail = \trim((string) ($smtpConfig['username'] ?? ''));
            }
        }

        return [
            'from_email' => $resolvedFromEmail,
            'from_name' => $resolvedFromName,
        ];
    }

    /**
     * @return array{
     *   mode: 'sequential'|'parallel',
     *   every: int,
     *   entries: list<array{id: string, label: string, mailer: MailerManager, from_email: string, from_name: ?string}>
     * }
     */
    private function buildSmtpRouting(array $config, string $campaignId): array
    {
        $rotationEnabled = !empty($config['smtp_rotation_enabled']);
        $mode = (($config['smtp_rotation_mode'] ?? 'sequential') === 'parallel') ? 'parallel' : 'sequential';
        $every = max(1, (int) ($config['smtp_rotation_every'] ?? 1));

        $ids = [];
        if ($rotationEnabled && !empty($config['smtp_rotation_ids']) && \is_array($config['smtp_rotation_ids'])) {
            foreach ($config['smtp_rotation_ids'] as $id) {
                $sid = trim((string) $id);
                if ($sid !== '' && !\in_array($sid, $ids, true)) {
                    $ids[] = $sid;
                }
            }
        }
        if ($ids === [] && !empty($config['smtp_config_id'])) {
            $ids[] = trim((string) $config['smtp_config_id']);
        }

        if ($ids === []) {
            throw new \RuntimeException('Aucune configuration SMTP sélectionnée.');
        }

        $smtpConfigManager = new \ChadMailer\Mailer\SMTPConfigManager();
        $entries = [];
        foreach ($ids as $id) {
            $smtpConfig = $smtpConfigManager->loadConfig($id);
            if (!$smtpConfig) {
                $this->writeCampaignLog($campaignId, "ERREUR: Configuration SMTP introuvable (ID: {$id})", 'error');
                continue;
            }
            $senderForSmtp = $this->resolveSenderForSmtp($config, $id, $smtpConfig);
            if (\trim((string) ($senderForSmtp['from_email'] ?? '')) === '') {
                $this->writeCampaignLog($campaignId, "ERREUR: From email manquant pour SMTP {$id}", 'error');
                continue;
            }
            $mailerConfig = [
                'provider' => $smtpConfig['provider'] ?? 'smtp',
                'credentials' => $smtpConfig,
                'from_email' => $senderForSmtp['from_email'],
                'from_name' => $senderForSmtp['from_name'] ?? '',
            ];
            $mailer = new \ChadMailer\Mailer\MailerManager($mailerConfig, $this->logger);
            try {
                $mailer->testConnection();
            } catch (\Throwable $e) {
                $this->writeCampaignLog($campaignId, "ERREUR: SMTP {$id} invalide - " . $e->getMessage(), 'error');
                continue;
            }
            $entries[] = [
                'id' => $id,
                'label' => (string) ($smtpConfig['name'] ?? $smtpConfig['host'] ?? $id),
                'mailer' => $mailer,
                'from_email' => $senderForSmtp['from_email'],
                'from_name' => $senderForSmtp['from_name'],
            ];
        }

        if ($entries === []) {
            throw new \RuntimeException('Aucune configuration SMTP valide disponible pour cette campagne.');
        }

        return ['mode' => $mode, 'every' => $every, 'entries' => $entries];
    }

    private function pickSmtpIndex(int $recipientIndex, int $smtpCount, int $every, string $mode): int
    {
        if ($smtpCount <= 1) {
            return 0;
        }
        if ($mode === 'parallel') {
            return $recipientIndex % $smtpCount;
        }

        return (int) \floor($recipientIndex / max(1, $every)) % $smtpCount;
    }

    /**
     * Crée une campagne.
     * Le front envoie { "name": "...", "config": { file_path, template_ids, ... } } — on ne stocke que l’objet interne dans config.
     */
    public function createCampaign(array $data): string
    {
        $campaignId = uniqid('campaign_', true);
        $name = $data['name'] ?? 'Campagne sans nom';

        if (isset($data['config']) && \is_array($data['config'])) {
            $configPayload = $data['config'];
        } else {
            $configPayload = $data;
            foreach (['name', 'id', 'status', 'created_at', 'stats', 'updated_at', 'started_at', 'completed_at', 'config'] as $k) {
                unset($configPayload[$k]);
            }
        }

        $campaign = [
            'id' => $campaignId,
            'name' => $name,
            'status' => 'pending',
            'created_at' => date('Y-m-d H:i:s'),
            'config' => $configPayload,
            'stats' => [
                'total' => 0,
                'sent' => 0,
                'failed' => 0,
                'pending' => 0
            ]
        ];

        $this->campaigns[$campaignId] = $campaign;
        $this->saveCampaign($campaign);

        return $campaignId;
    }

    /**
     * Écrit un log dans le fichier de log de la campagne
     */
    private function writeCampaignLog(string $campaignId, string $message, string $level = 'info'): void
    {
        $logFile = $this->getCampaignLogFile($campaignId);
        $timestamp = date('Y-m-d H:i:s');
        $logEntry = "[{$timestamp}] [{$level}] {$message}\n";
        
        // Utiliser fopen/fwrite pour forcer le flush immédiat
        $handle = fopen($logFile, 'a');
        if ($handle) {
            fwrite($handle, $logEntry);
            fflush($handle); // Force l'écriture immédiate
            fclose($handle);
        }
    }

    /**
     * Retourne le chemin du fichier de log de campagne
     */
    private function getCampaignLogFile(string $campaignId): string
    {
        return $this->storageDir . '/' . $campaignId . '.log';
    }

    /**
     * Récupère les logs d'une campagne
     */
    public function getCampaignLogs(string $campaignId, int $lines = 100): array
    {
        $logFile = $this->getCampaignLogFile($campaignId);
        if (!file_exists($logFile)) {
            return [];
        }

        $content = file_get_contents($logFile);
        $allLines = explode("\n", trim($content));
        $allLines = array_filter($allLines); // Enlever les lignes vides
        
        // Retourner les N dernières lignes
        return array_slice($allLines, -$lines);
    }

    /**
     * Retourne toutes les lignes de log depuis l'offset fourni (inclus) et le total courant.
     *
     * Utilisé par le polling front pour un suivi monotone : le frontend envoie le
     * nombre de lignes déjà affichées et reçoit uniquement les nouvelles. Évite la
     * troncature à 500 lignes qui bloquait l'affichage temps réel pour les longues
     * campagnes.
     *
     * @return array{total: int, offset: int, lines: array<int, string>}
     */
    public function getCampaignLogsSince(string $campaignId, int $offset): array
    {
        $logFile = $this->getCampaignLogFile($campaignId);
        if (!file_exists($logFile)) {
            return ['total' => 0, 'offset' => max(0, $offset), 'lines' => []];
        }

        $content = file_get_contents($logFile);
        if ($content === false) {
            return ['total' => 0, 'offset' => max(0, $offset), 'lines' => []];
        }

        $normalized = str_replace("\r\n", "\n", $content);
        $allLines = array_values(array_filter(
            explode("\n", $normalized),
            static fn ($line) => $line !== ''
        ));
        $total = \count($allLines);

        $startIndex = max(0, min($offset, $total));
        $lines = array_values(array_slice($allLines, $startIndex));

        return ['total' => $total, 'offset' => $startIndex, 'lines' => $lines];
    }

    /**
     * Lance l'envoi d'une campagne
     */
    public function sendCampaign(string $campaignId, ?callable $progressCallback = null): void
    {
        $campaign = $this->loadCampaign($campaignId);
        if (!$campaign) {
            throw new \Exception("Campagne non trouvée: {$campaignId}");
        }

        $config = $campaign['config'];
        $filePath = trim((string)($config['file_path'] ?? $config['csv_path'] ?? ''));

        $logFile = $this->getCampaignLogFile($campaignId);
        if (file_exists($logFile)) {
            unlink($logFile);
        }

        if ($filePath === '' || !is_file($filePath)) {
            $campaign['status'] = 'failed';
            $campaign['completed_at'] = date('Y-m-d H:i:s');
            $this->updateCampaign($campaign);
            $reason = $filePath === ''
                ? 'Aucun fichier liste (file_path manquant). Recréez la campagne depuis l’interface avec une liste importée.'
                : 'Fichier liste introuvable sur le serveur : ' . $filePath;
            $this->writeCampaignLog($campaignId, 'ERREUR: ' . $reason, 'error');
            return;
        }

        $campaign['status'] = 'running';
        $campaign['started_at'] = date('Y-m-d H:i:s');
        $this->updateCampaign($campaign);
        $startMsg = "Démarrage de la campagne: " . $campaign['name'];
        $this->writeCampaignLog($campaignId, $startMsg);
        error_log("Campaign {$campaignId}: {$startMsg}", 0);

        $fileType = $config['file_type'] ?? 'csv';
        $columnMapping = $config['column_mapping'] ?? null;

        $fileMsg = "Chargement du fichier: {$filePath} (type: {$fileType})";
        $this->writeCampaignLog($campaignId, $fileMsg);
        error_log("Campaign {$campaignId}: {$fileMsg}", 0);
        
        $recipients = $this->recipientParser->parse($filePath, $fileType, $columnMapping);
        $campaign['stats']['total'] = count($recipients);
        $this->updateCampaign($campaign);
        $recipientsMsg = count($recipients) . " destinataires chargés";
        $this->writeCampaignLog($campaignId, $recipientsMsg);
        error_log("Campaign {$campaignId}: {$recipientsMsg}", 0);

        // Charger les templates
        $templates = $this->templateManager->getTemplates($config['template_ids'] ?? []);
        $templatesMsg = count($templates) . " template(s) chargé(s)";
        $this->writeCampaignLog($campaignId, $templatesMsg);
        error_log("Campaign {$campaignId}: {$templatesMsg}", 0);
        
        [$dMin, $dMax] = $this->normalizeCampaignDelayRange($config);
        $delayMsg = sprintf('Délai entre e-mails : %.3f–%.3f s (aléatoire dans la plage)', $dMin, $dMax);
        $this->writeCampaignLog($campaignId, $delayMsg);
        error_log("Campaign {$campaignId}: {$delayMsg}", 0);

        // Préparer la/les route(s) SMTP
        try {
            $smtpRouting = $this->buildSmtpRouting($config, $campaignId);
        } catch (\Throwable $e) {
            $this->writeCampaignLog($campaignId, "ERREUR: " . $e->getMessage(), 'error');
            $campaign['status'] = 'failed';
            $campaign['completed_at'] = date('Y-m-d H:i:s');
            $this->updateCampaign($campaign);
            return;
        }
        $smtpPool = $smtpRouting['entries'];
        $smtpMode = $smtpRouting['mode'];
        $smtpEvery = $smtpRouting['every'];
        $smtpCount = \count($smtpPool);
        $smtpLabels = array_map(static fn (array $e): string => $e['label'], $smtpPool);
        $this->writeCampaignLog(
            $campaignId,
            sprintf(
                'SMTP routing: mode=%s, every=%d, pool=%d (%s)',
                $smtpMode,
                $smtpEvery,
                $smtpCount,
                implode(', ', $smtpLabels)
            )
        );
        $smtpNextReadyAt = array_fill(0, max(1, $smtpCount), 0.0);

        // Déduplication (optionnelle)
        if ($this->shouldDeduplicateRecipients($config)) {
            $dedupResult = $this->recipientParser->deduplicate($recipients);
            $recipients = $dedupResult['recipients'];
            if ($dedupResult['duplicates_removed'] > 0) {
                $this->writeCampaignLog($campaignId,
                    '[INFO] Déduplication: ' . $dedupResult['duplicates_removed'] . ' doublons supprimés (' . count($recipients) . ' destinataires restants)'
                );
            }
        } else {
            $this->writeCampaignLog($campaignId,
                '[INFO] Déduplication désactivée : ' . count($recipients) . ' lignes conservées (répétitions d’adresse autorisées).'
            );
        }

        // Segmentation par domaine
        $domainFilters = $config['domain_filters'] ?? [];
        $gmailLast = $config['gmail_last'] ?? false;
        if (!empty($domainFilters) || $gmailLast) {
            $recipients = $this->recipientParser->filterByDomains($recipients, $domainFilters, $gmailLast);
        }

        // Mettre à jour le total après dédup + filtrage
        $campaign['stats']['total'] = count($recipients);
        $this->updateCampaign($campaign);

        // Paths pour pause/stop
        $pauseFile = $this->storageDir . '/' . $campaignId . '.pause';
        $stopFile  = $this->storageDir . '/' . $campaignId . '.stop';

        [$delayMin, $delayMax] = $this->normalizeCampaignDelayRange($config);

        // Header List-Unsubscribe
        $unsubUrl = $config['unsubscribe_url'] ?? '';

        // Fréquence de rotation des templates
        $rotationFrequency = $config['template_rotation_frequency'] ?? 1;

        $total = count($recipients);
        foreach ($recipients as $index => $recipient) {
            $current = $index + 1;
            $progress = round($current / $total * 100, 1);
            
            try {
                // Rotation de templates avec la fréquence spécifiée
                $template = $this->templateManager->getRotatedTemplate($templates, $index, $rotationFrequency);

                $personalData = $this->templateManager->mergeRecipientWithTemplateVars($recipient, $template, $index);
                $emailContent = $this->templateManager->personalize($template, $personalData);

                // Créer l'email avec Symfony Mime
                $email = new \Symfony\Component\Mime\Email();
                $smtpIdx = $this->pickSmtpIndex($index, $smtpCount, $smtpEvery, $smtpMode);
                $smtpEntry = $smtpPool[$smtpIdx];
                
                // From
                $fromEmail = (string) ($smtpEntry['from_email'] ?? ($config['from_email'] ?? ''));
                $fromName = !empty($smtpEntry['from_name'])
                    ? (string) $smtpEntry['from_name']
                    : (!empty($config['from_name']) ? (string) $config['from_name'] : null);
                if ($fromName) {
                    $email->from(new \Symfony\Component\Mime\Address($fromEmail, $fromName));
                } else {
                    $email->from($fromEmail);
                }
                
                // To
                $recipientEmail = $recipient['email'];
                $recipientName = !empty($recipient['name']) ? $recipient['name'] : null;
                if ($recipientName) {
                    $email->to(new \Symfony\Component\Mime\Address($recipientEmail, $recipientName));
                } else {
                    $email->to($recipientEmail);
                }
                
                // Subject
                $email->subject($this->templateManager->personalizeString($template['subject'], $personalData));
                
                // Body
                if (!empty($emailContent['html'])) {
                    $email->html($emailContent['html']);
                }
                if (!empty($emailContent['text'])) {
                    $email->text($emailContent['text']);
                }

                // Headers List-Unsubscribe
                if (!empty($unsubUrl)) {
                    $email->getHeaders()->addTextHeader(
                        'List-Unsubscribe',
                        '<' . $unsubUrl . '?cid=' . $campaignId . '>, <mailto:unsub@noreply.invalid>'
                    );
                    $email->getHeaders()->addTextHeader('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
                } else {
                    $email->getHeaders()->addTextHeader('List-Unsubscribe', '<mailto:unsub@noreply.invalid>');
                }

                if ($smtpMode === 'parallel') {
                    $now = microtime(true);
                    $wait = $smtpNextReadyAt[$smtpIdx] - $now;
                    if ($wait > 0) {
                        usleep((int) round($wait * 1_000_000));
                    }
                }

                $smtpEntry['mailer']->send($email);
                
                $campaign['stats']['sent']++;
                $logMsg = "[{$current}/{$total}] ({$progress}%) Email envoyé à: {$recipientEmail} via SMTP: {$smtpEntry['label']}";
                $this->writeCampaignLog($campaignId, $logMsg);
                $this->logger->info("Email envoyé", [
                    'campaign' => $campaignId,
                    'recipient' => $recipientEmail
                ]);
                // Log aussi dans le terminal pour suivi en temps réel
                error_log("Campaign {$campaignId}: {$logMsg}", 0);

                if ($progressCallback) {
                    $progressCallback($index + 1, $total, $recipient);
                }

                if ($smtpMode === 'parallel') {
                    $smtpNextReadyAt[$smtpIdx] = microtime(true) + $this->computeRandomInterEmailDelaySeconds($delayMin, $delayMax);
                } else {
                    // Délai global entre les e-mails (secondes fractionnaires possibles)
                    $this->sleepRandomInterEmailDelay($delayMin, $delayMax);
                }

            } catch (\Exception $e) {
                $campaign['stats']['failed']++;
                $recipientEmail = $recipient['email'] ?? 'unknown';
                
                // Logger l'erreur dans le fichier de log de la campagne
                $errorMsg = $e->getMessage();
                $logMsg = "[{$current}/{$total}] ÉCHEC pour {$recipientEmail}: {$errorMsg}";
                $this->writeCampaignLog($campaignId, $logMsg, 'error');
                
                // Stocker l'email en échec dans la campagne pour pouvoir le relancer
                if (!isset($campaign['failed_recipients'])) {
                    $campaign['failed_recipients'] = [];
                }
                $campaign['failed_recipients'][] = [
                    'email' => $recipientEmail,
                    'recipient' => $recipient,
                    'error' => $errorMsg,
                    'timestamp' => date('Y-m-d H:i:s')
                ];
                
                $this->logger->error("Erreur envoi email", [
                    'campaign' => $campaignId,
                    'recipient' => $recipientEmail,
                    'error' => $errorMsg
                ]);
                // Log aussi dans le terminal
                error_log("Campaign {$campaignId}: {$logMsg}", 0);
            }

            $this->updateCampaign($campaign);

            // Pause / Stop
            if (file_exists($pauseFile)) {
                $this->writeCampaignLog($campaignId, '[INFO] Campagne en pause...');
                while (file_exists($pauseFile) && !file_exists($stopFile)) {
                    sleep(1);
                }
            }
            if (file_exists($stopFile)) {
                unlink($stopFile);
                $this->writeCampaignLog($campaignId, '[INFO] Campagne stoppée par l\'utilisateur.');
                $campaign['status'] = 'stopped';
                $campaign['completed_at'] = date('Y-m-d H:i:s');
                $this->updateCampaign($campaign);
                return;
            }
        }

        $campaign['status'] = 'completed';
        $campaign['completed_at'] = date('Y-m-d H:i:s');
        $this->updateCampaign($campaign);
        $finalMsg = "Campagne terminée! Envoyés: {$campaign['stats']['sent']}, Échecs: {$campaign['stats']['failed']}";
        $this->writeCampaignLog($campaignId, $finalMsg);
        error_log("Campaign {$campaignId}: {$finalMsg}", 0);
    }

    /**
     * Charge une campagne depuis le stockage
     */
    public function loadCampaign(string $campaignId): ?array
    {
        $file = $this->getCampaignFile($campaignId);
        if (!file_exists($file)) {
            return null;
        }
        $campaign = json_decode(file_get_contents($file), true);
        if (!\is_array($campaign)) {
            return null;
        }
        if (isset($campaign['config']) && \is_array($campaign['config'])) {
            $campaign['config'] = $this->unwrapCampaignConfig($campaign['config']);
        }

        return $campaign;
    }

    /**
     * Destinataires après parse, dédup et filtres domaine — aligné sur le début de sendCampaign (aperçu / ETA).
     *
     * @throws \Exception Si fichier liste manquant ou illisible
     */
    public function buildRecipientListForPreview(array $config): array
    {
        $filePath = trim((string)($config['file_path'] ?? $config['csv_path'] ?? ''));
        if ($filePath === '' || !is_file($filePath)) {
            throw new \Exception('Fichier liste introuvable pour la prévisualisation.');
        }
        $fileType = $config['file_type'] ?? 'csv';
        $columnMapping = $config['column_mapping'] ?? null;
        $recipients = $this->recipientParser->parse($filePath, $fileType, $columnMapping);
        if ($this->shouldDeduplicateRecipients($config)) {
            $dedupResult = $this->recipientParser->deduplicate($recipients);
            $recipients = $dedupResult['recipients'];
        }
        $domainFilters = $config['domain_filters'] ?? [];
        $gmailLast = $config['gmail_last'] ?? false;
        if (!empty($domainFilters) || $gmailLast) {
            $recipients = $this->recipientParser->filterByDomains($recipients, $domainFilters, $gmailLast);
        }

        return $recipients;
    }

    /**
     * Sauvegarde une campagne
     */
    private function saveCampaign(array $campaign): void
    {
        $file = $this->getCampaignFile($campaign['id']);
        file_put_contents($file, json_encode($campaign, JSON_PRETTY_PRINT));
    }

    /**
     * Met à jour une campagne
     */
    private function updateCampaign(array $campaign): void
    {
        $this->saveCampaign($campaign);
    }

    /**
     * Retourne le chemin du fichier de campagne
     */
    private function getCampaignFile(string $campaignId): string
    {
        // Utiliser un répertoire persistant
        $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: (getenv('HOMEPATH') ?: ''));
        
        if ($homeDir) {
            $dir = $homeDir . '/.chadmailer/campaigns';
        } else {
            // Fallback : répertoire relatif
            $dir = __DIR__ . '/../../campaigns';
        }
        
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        return $dir . '/' . $campaignId . '.json';
    }

    /**
     * Liste toutes les campagnes (triées par date décroissante)
     */
    public function listCampaigns(): array
    {
        // Utiliser le même répertoire que getCampaignFile()
        $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: (getenv('HOMEPATH') ?: ''));
        
        if ($homeDir) {
            $dir = $homeDir . '/.chadmailer/campaigns';
        } else {
            // Fallback : répertoire relatif
            $dir = __DIR__ . '/../../campaigns';
        }
        
        if (!is_dir($dir)) {
            return [];
        }
        
        $campaigns = [];
        foreach (glob($dir . '/*.json') as $file) {
            $campaign = json_decode(file_get_contents($file), true);
            if ($campaign && \is_array($campaign)) {
                if (isset($campaign['config']) && \is_array($campaign['config'])) {
                    $campaign['config'] = $this->unwrapCampaignConfig($campaign['config']);
                }
                $campaigns[] = $campaign;
            }
        }
        
        // Trier par date de création décroissante (la plus récente en premier)
        usort($campaigns, function($a, $b) {
            $dateA = $a['created_at'] ?? '1970-01-01 00:00:00';
            $dateB = $b['created_at'] ?? '1970-01-01 00:00:00';
            return strtotime($dateB) - strtotime($dateA);
        });
        
        return $campaigns;
    }

    /**
     * Relance les emails en échec d'une campagne
     */
    public function retryFailedRecipients(string $campaignId, ?callable $progressCallback = null): void
    {
        $campaign = $this->loadCampaign($campaignId);
        if (!$campaign) {
            throw new \Exception("Campagne non trouvée: {$campaignId}");
        }

        if (empty($campaign['failed_recipients']) || count($campaign['failed_recipients']) === 0) {
            throw new \Exception("Aucun email en échec à relancer");
        }

        $config = $campaign['config'];
        
        $smtpRouting = $this->buildSmtpRouting($config, $campaignId);
        $smtpPool = $smtpRouting['entries'];
        $smtpMode = $smtpRouting['mode'];
        $smtpEvery = $smtpRouting['every'];
        $smtpCount = count($smtpPool);
        $smtpNextReadyAt = array_fill(0, max(1, $smtpCount), 0.0);

        // Charger les templates
        $templates = $this->templateManager->getTemplates($config['template_ids'] ?? []);
        $rotationFrequency = $config['template_rotation_frequency'] ?? 1;
        [$delayMin, $delayMax] = $this->normalizeCampaignDelayRange($config);

        $this->writeCampaignLog($campaignId, "Relance des emails en échec: " . count($campaign['failed_recipients']) . " destinataires");

        $failedRecipients = $campaign['failed_recipients'];
        $campaign['failed_recipients'] = []; // Réinitialiser la liste
        $retryStats = ['sent' => 0, 'failed' => 0];

        foreach ($failedRecipients as $index => $failedData) {
            $recipient = $failedData['recipient'];
            $current = $index + 1;
            $total = count($failedRecipients);
            
            try {
                // Rotation de templates
                $template = $this->templateManager->getRotatedTemplate($templates, $index, $rotationFrequency);

                $personalData = $this->templateManager->mergeRecipientWithTemplateVars($recipient, $template, $index);
                $emailContent = $this->templateManager->personalize($template, $personalData);

                // Créer l'email
                $email = new \Symfony\Component\Mime\Email();
                $smtpIdx = $this->pickSmtpIndex($index, $smtpCount, $smtpEvery, $smtpMode);
                $smtpEntry = $smtpPool[$smtpIdx];
                
                $fromEmail = (string) ($smtpEntry['from_email'] ?? ($config['from_email'] ?? ''));
                $fromName = !empty($smtpEntry['from_name'])
                    ? (string) $smtpEntry['from_name']
                    : (!empty($config['from_name']) ? (string) $config['from_name'] : null);
                if ($fromName) {
                    $email->from(new \Symfony\Component\Mime\Address($fromEmail, $fromName));
                } else {
                    $email->from($fromEmail);
                }
                
                $recipientEmail = $recipient['email'];
                $recipientName = !empty($recipient['name']) ? $recipient['name'] : null;
                if ($recipientName) {
                    $email->to(new \Symfony\Component\Mime\Address($recipientEmail, $recipientName));
                } else {
                    $email->to($recipientEmail);
                }
                
                $email->subject($this->templateManager->personalizeString($template['subject'], $personalData));
                
                if (!empty($emailContent['html'])) {
                    $email->html($emailContent['html']);
                }
                if (!empty($emailContent['text'])) {
                    $email->text($emailContent['text']);
                }

                if ($smtpMode === 'parallel') {
                    $now = microtime(true);
                    $wait = $smtpNextReadyAt[$smtpIdx] - $now;
                    if ($wait > 0) {
                        usleep((int) round($wait * 1_000_000));
                    }
                }

                $smtpEntry['mailer']->send($email);
                
                $retryStats['sent']++;
                $campaign['stats']['sent']++;
                $campaign['stats']['failed']--;
                
                $logMsg = "[{$current}/{$total}] RELANCE réussie pour: {$recipientEmail} via SMTP: {$smtpEntry['label']}";
                $this->writeCampaignLog($campaignId, $logMsg);

                if ($progressCallback) {
                    $progressCallback($current, $total, $recipient);
                }

                if ($smtpMode === 'parallel') {
                    $smtpNextReadyAt[$smtpIdx] = microtime(true) + $this->computeRandomInterEmailDelaySeconds($delayMin, $delayMax);
                } else {
                    $this->sleepRandomInterEmailDelay($delayMin, $delayMax);
                }

            } catch (\Exception $e) {
                $retryStats['failed']++;
                
                // Remettre dans la liste des échecs
                $campaign['failed_recipients'][] = [
                    'email' => $recipient['email'],
                    'recipient' => $recipient,
                    'error' => $e->getMessage(),
                    'timestamp' => date('Y-m-d H:i:s')
                ];
                
                $logMsg = "[{$current}/{$total}] RELANCE échouée pour {$recipient['email']}: {$e->getMessage()}";
                $this->writeCampaignLog($campaignId, $logMsg, 'error');
            }

            $this->updateCampaign($campaign);
        }

        $finalMsg = "Relance terminée! Envoyés: {$retryStats['sent']}, Échecs: {$retryStats['failed']}";
        $this->writeCampaignLog($campaignId, $finalMsg);
    }

    public function getCampaign(string $id): ?array
    {
        return $this->loadCampaign($id);
    }

    public function pauseCampaign(string $id): void
    {
        file_put_contents($this->storageDir . '/' . $id . '.pause', '1');
    }

    public function resumeCampaign(string $id): void
    {
        $f = $this->storageDir . '/' . $id . '.pause';
        if (file_exists($f)) { unlink($f); }
    }

    public function stopCampaign(string $id): void
    {
        file_put_contents($this->storageDir . '/' . $id . '.stop', '1');
        $this->resumeCampaign($id);
    }

    public function markInterrupted(string $id): void
    {
        $campaign = $this->loadCampaign($id);
        if ($campaign) {
            $campaign['status'] = 'interrupted';
            $campaign['interrupted_at'] = date('Y-m-d H:i:s');
            $this->updateCampaign($campaign);
        }
    }

    public function streamCampaignLogs(string $id): void
    {
        $logFile = $this->getCampaignLogFile($id);
        $campaignFile = $this->getCampaignFile($id);

        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('X-Accel-Buffering: no');
        if (ob_get_level() > 0) {
            ob_end_clean();
        }

        $nextLineIndex = 0;
        $maxWait = 300;
        $waited = 0;

        while ($waited < $maxWait) {
            if (file_exists($campaignFile)) {
                $camp = json_decode(file_get_contents($campaignFile), true);
                if (in_array($camp['status'] ?? '', ['completed', 'failed', 'stopped', 'interrupted'])) {
                    if (file_exists($logFile)) {
                        $content = file_get_contents($logFile);
                        $lines = explode("\n", str_replace("\r\n", "\n", $content));
                        for ($i = $nextLineIndex; $i < count($lines); $i++) {
                            $line = trim($lines[$i]);
                            if ($line !== '') {
                                echo "event: log\n";
                                echo "data: " . json_encode($this->parseLogLine($line)) . "\n\n";
                            }
                        }
                    }
                    $stats = $camp['stats'] ?? [];
                    echo "event: done\n";
                    echo "data: " . json_encode([
                        'status' => $camp['status'],
                        'sent' => $stats['sent'] ?? 0,
                        'failed' => $stats['failed'] ?? 0,
                    ]) . "\n\n";
                    flush();
                    return;
                }
                $stats = $camp['stats'] ?? [];
                $total = $stats['total'] ?? 0;
                $sent = $stats['sent'] ?? 0;
                $failed = $stats['failed'] ?? 0;
                $percent = $total > 0 ? round(($sent + $failed) / $total * 100) : 0;
                echo "event: stats\n";
                echo "data: " . json_encode([
                    'sent' => $sent,
                    'failed' => $failed,
                    'remaining' => max(0, $total - $sent - $failed),
                    'total' => $total,
                    'percent' => $percent,
                ]) . "\n\n";
            }

            if (file_exists($logFile)) {
                $content = file_get_contents($logFile);
                $lines = explode("\n", str_replace("\r\n", "\n", $content));
                for ($i = $nextLineIndex; $i < count($lines); $i++) {
                    $line = trim($lines[$i]);
                    if ($line !== '') {
                        echo "event: log\n";
                        echo "data: " . json_encode($this->parseLogLine($line)) . "\n\n";
                    }
                }
                $nextLineIndex = count($lines);
            }

            flush();
            sleep(1);
            $waited++;
        }

        echo "event: done\n";
        echo "data: " . json_encode(['status' => 'timeout']) . "\n\n";
        flush();
    }

    private function parseLogLine(string $line): array
    {
        $status = 'info';
        if (str_contains($line, 'ÉCHEC') || str_contains($line, 'ERREUR') || str_contains($line, 'failed')) {
            $status = 'failed';
        } elseif (str_contains($line, 'envoyé') || str_contains($line, 'Envoyé')) {
            $status = 'ok';
        } elseif (str_contains($line, 'retry') || str_contains($line, 'Retry')) {
            $status = 'retry';
        }
        $time = '';
        if (preg_match('/\[(\d{2}:\d{2}:\d{2})\]/', $line, $m)) {
            $time = $m[1];
        } elseif (preg_match('/(\d{2}:\d{2}:\d{2})/', $line, $m)) {
            $time = $m[1];
        }
        return ['time' => $time ?: date('H:i:s'), 'status' => $status, 'message' => $line];
    }

    /**
     * Supprime une campagne et ses fichiers associés
     */
    public function deleteCampaign(string $campaignId): bool
    {
        // Supprimer le fichier de campagne
        $campaignFile = $this->getCampaignFile($campaignId);
        $deleted = false;
        
        if (file_exists($campaignFile)) {
            $deleted = unlink($campaignFile);
        }
        
        // Supprimer le fichier de logs associé
        $logFile = $this->getCampaignLogFile($campaignId);
        if (file_exists($logFile)) {
            unlink($logFile);
        }
        
        return $deleted;
    }
}

