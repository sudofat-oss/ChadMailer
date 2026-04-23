#!/usr/bin/env php
<?php

require_once __DIR__ . '/vendor/autoload.php';

use ChadMailer\Config\ConfigManager;
use ChadMailer\Template\TemplateManager;
use ChadMailer\CSV\RecipientParser;
use ChadMailer\Mailer\MailerManager;
use ChadMailer\Mailer\SMTPConfigManager;
use ChadMailer\CampaignManager;
use Monolog\Logger;
use Monolog\Handler\StreamHandler;

// Sous-commande: php cli.php send {campaignId}
if (isset($argv[1]) && $argv[1] === 'send') {
    $campaignId = $argv[2] ?? null;
    if (!$campaignId) {
        echo "Usage: php cli.php send <campaignId>\n";
        exit(1);
    }

    $configManager = new ConfigManager();
    $logger = new Logger('chadmailer');
    $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: '');
    $storagePath = $homeDir ? $homeDir . '/.chadmailer/storage' : __DIR__ . '/storage';
    if (!is_dir($storagePath)) { mkdir($storagePath, 0755, true); }
    $logger->pushHandler(new StreamHandler($storagePath . '/app.log', Logger::INFO));

    $mailerConfig = $configManager->get('mailer', []);
    $mailerManager = new MailerManager($mailerConfig, $logger);
    $templateManager = new TemplateManager();
    $recipientParser = new RecipientParser();
    $campaignManager = new CampaignManager($templateManager, $recipientParser, $mailerManager, $logger);

    try {
        $campaignManager->sendCampaign($campaignId);
    } catch (\Exception $e) {
        $logger->error('Send failed: ' . $e->getMessage());
        exit(1);
    }
    exit(0);
}

// Mode serveur web par défaut
$port = $argv[1] ?? 8000;
$host = $argv[2] ?? 'localhost';

echo "ChadMailer - Serveur sur http://{$host}:{$port}\n";
echo "Ouvrez: http://{$host}:{$port}/index.html\n";
echo "Ctrl+C pour arrêter ce processus (les envois lancés en arrière-plan peuvent encore tourner quelques secondes).\n";
echo "Note : le serveur intégré PHP traite les requêtes une par une ; le suivi campagne utilise du polling, pas de SSE long.\n\n";

passthru(sprintf('php -S %s:%d -t %s', $host, (int) $port, escapeshellarg(__DIR__ . '/public')));
