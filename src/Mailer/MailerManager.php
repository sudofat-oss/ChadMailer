<?php

namespace ChadMailer\Mailer;

use Monolog\Logger;
use Symfony\Component\Mailer\Mailer as SymfonyMailer;
use Symfony\Component\Mailer\Transport;
use Symfony\Component\Mailer\Transport\Dsn;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\Address;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoApiTransport;

class MailerManager
{
    private ?SymfonyMailer $mailer = null;
    private Logger $logger;
    private array $config;
    private bool $initialized = false;

    public function __construct(array $config, Logger $logger)
    {
        $this->config = $config;
        $this->logger = $logger;
    }

    /**
     * Parse une URL de proxy et retourne les composants
     */
    private function parseProxyUrl(string $proxyUrl): array
    {
        $parsed = parse_url($proxyUrl);
        return [
            'scheme' => $parsed['scheme'] ?? 'socks5',
            'host' => $parsed['host'] ?? '',
            'port' => $parsed['port'] ?? 1080,
            'user' => $parsed['user'] ?? '',
            'pass' => $parsed['pass'] ?? ''
        ];
    }

    /**
     * Crée un HTTP Client avec proxy si configuré
     */
    private function createHttpClient(): ?\Symfony\Contracts\HttpClient\HttpClientInterface
    {
        $credentials = $this->config['credentials'] ?? [];
        $proxyUrl = $credentials['proxy'] ?? '';
        
        if (empty($proxyUrl)) {
            return null;
        }

        $this->logger->info("Configuration du proxy", ['proxy' => preg_replace('/:[^:]+@/', ':***@', $proxyUrl)]);
        
        return HttpClient::create([
            'proxy' => $proxyUrl,
            'timeout' => 30,
            'verify_peer' => false,
            'verify_host' => false
        ]);
    }

    /**
     * Initialise le mailer selon la configuration
     */
    private function initializeMailer(): void
    {
        $provider = $this->config['provider'] ?? 'smtp';
        $credentials = $this->config['credentials'] ?? [];

        try {
            switch (strtolower($provider)) {
                case 'smtp':
                    $this->initializeSMTP($credentials);
                    break;

                case 'brevo':
                    $this->initializeBrevo($credentials);
                    break;

                case 'mailgun':
                    $this->initializeMailgun($credentials);
                    break;

                case 'sendgrid':
                    $this->initializeSendGrid($credentials);
                    break;

                case 'postmark':
                    $this->initializePostmark($credentials);
                    break;

                case 'ses':
                case 'amazonses':
                    $this->initializeAmazonSES($credentials);
                    break;

                case 'office365':
                    $this->initializeOffice365($credentials);
                    break;

                default:
                    throw new \Exception("Provider non supporté: {$provider}");
            }
        } catch (\Exception $e) {
            $this->logger->error("Erreur initialisation mailer", [
                'provider' => $provider,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Initialise un transport SMTP (avec support proxy si disponible)
     */
    private function initializeSMTP(array $credentials): void
    {
        $host = $credentials['host'] ?? 'localhost';
        $port = (int)($credentials['port'] ?? 587);
        $username = $credentials['username'] ?? '';
        $password = $credentials['password'] ?? '';
        $encryption = $credentials['encryption'] ?? 'tls';
        $proxyUrl = $credentials['proxy'] ?? '';

        // Construire le DSN SMTP
        $scheme = 'smtp';
        if ($encryption === 'ssl') {
            $scheme = 'smtps';
        }

        $dsn = sprintf(
            '%s://%s:%s@%s:%d',
            $scheme,
            urlencode($username),
            urlencode($password),
            $host,
            $port
        );

        // Note: Le proxy SOCKS5 pour SMTP nécessite une configuration spéciale
        // On utilise le stream context pour le proxy
        if (!empty($proxyUrl)) {
            $this->logger->info("SMTP avec proxy", ['proxy' => preg_replace('/:[^:]+@/', ':***@', $proxyUrl)]);
            
            // Parser le proxy URL
            $proxy = $this->parseProxyUrl($proxyUrl);
            
            // Créer un transport SMTP personnalisé avec proxy
            $transport = $this->createSMTPTransportWithProxy($credentials, $proxy);
        } else {
            $transport = Transport::fromDsn($dsn);
        }
        
        $this->mailer = new SymfonyMailer($transport);
    }

    /**
     * Microsoft 365 / Exchange Online — soumission SMTP authentifiée (SMTP AUTH).
     *
     * @see https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/authenticated-client-smtp-submission
     */
    private function initializeOffice365(array $credentials): void
    {
        $host = trim((string) ($credentials['host'] ?? ''));
        if ($host === '') {
            $host = 'smtp.office365.com';
        }
        $port = (int) ($credentials['port'] ?? 587);
        if ($port <= 0) {
            $port = 587;
        }
        $encryption = strtolower(trim((string) ($credentials['encryption'] ?? 'tls')));
        if (!\in_array($encryption, ['tls', 'ssl'], true)) {
            $encryption = 'tls';
        }

        $smtpCreds = [
            'host' => $host,
            'port' => $port,
            'username' => $credentials['username'] ?? '',
            'password' => $credentials['password'] ?? '',
            'encryption' => $encryption,
            'proxy' => $credentials['proxy'] ?? '',
        ];

        $this->initializeSMTP($smtpCreds);
    }

    /**
     * Crée un transport SMTP avec support proxy SOCKS5
     */
    private function createSMTPTransportWithProxy(array $credentials, array $proxy): \Symfony\Component\Mailer\Transport\TransportInterface
    {
        $host = $credentials['host'] ?? 'localhost';
        $port = (int)($credentials['port'] ?? 587);
        $username = $credentials['username'] ?? '';
        $password = $credentials['password'] ?? '';
        $encryption = $credentials['encryption'] ?? 'tls';

        // Pour SOCKS5, on doit créer une connexion via le proxy
        // Symfony Mailer ne supporte pas nativement les proxies SOCKS5 pour SMTP
        // On utilise une approche via stream_socket_client avec contexte proxy
        
        $scheme = $encryption === 'ssl' ? 'smtps' : 'smtp';
        
        // Construire le DSN avec les infos de base
        $dsn = sprintf(
            '%s://%s:%s@%s:%d',
            $scheme,
            urlencode($username),
            urlencode($password),
            $host,
            $port
        );

        // Créer le transport - pour SMTP, le proxy est plus complexe à gérer
        // On va utiliser une variable d'environnement pour curl
        $proxyAuth = '';
        if (!empty($proxy['user'])) {
            $proxyAuth = $proxy['user'];
            if (!empty($proxy['pass'])) {
                $proxyAuth .= ':' . $proxy['pass'];
            }
            $proxyAuth .= '@';
        }
        
        $proxyString = sprintf('%s://%s%s:%d', 
            $proxy['scheme'], 
            $proxyAuth, 
            $proxy['host'], 
            $proxy['port']
        );
        
        // Configurer les variables d'environnement pour le proxy
        // Cela fonctionne pour les transports qui utilisent curl
        putenv('ALL_PROXY=' . $proxyString);
        putenv('HTTPS_PROXY=' . $proxyString);
        
        return Transport::fromDsn($dsn);
    }

    /**
     * Initialise Brevo (SendinBlue) via API avec support proxy
     */
    private function initializeBrevo(array $credentials): void
    {
        $apiKey = $credentials['api_key'] ?? '';
        
        if (empty($apiKey)) {
            throw new \Exception("La clé API Brevo est requise");
        }

        $httpClient = $this->createHttpClient();
        
        if ($httpClient) {
            // Utiliser le transport Brevo avec HTTP client personnalisé
            $transport = new BrevoApiTransport($apiKey, $httpClient);
        } else {
            $dsn = sprintf('brevo+api://%s@default', urlencode($apiKey));
            $transport = Transport::fromDsn($dsn);
        }
        
        $this->mailer = new SymfonyMailer($transport);
    }

    /**
     * Initialise Mailgun via API
     */
    private function initializeMailgun(array $credentials): void
    {
        $apiKey = $credentials['api_key'] ?? '';
        $domain = $credentials['domain'] ?? '';
        $region = $credentials['region'] ?? 'us';
        
        if (empty($apiKey) || empty($domain)) {
            throw new \Exception("La clé API et le domaine Mailgun sont requis");
        }

        $dsn = sprintf(
            'mailgun+api://%s:%s@default?region=%s',
            urlencode($apiKey),
            urlencode($domain),
            $region
        );
        
        // Configurer le proxy via variable d'environnement si présent
        $proxyUrl = $credentials['proxy'] ?? '';
        if (!empty($proxyUrl)) {
            putenv('ALL_PROXY=' . $proxyUrl);
            putenv('HTTPS_PROXY=' . $proxyUrl);
        }
        
        $transport = Transport::fromDsn($dsn);
        $this->mailer = new SymfonyMailer($transport);
    }

    /**
     * Initialise SendGrid via API
     */
    private function initializeSendGrid(array $credentials): void
    {
        $apiKey = $credentials['api_key'] ?? '';
        
        if (empty($apiKey)) {
            throw new \Exception("La clé API SendGrid est requise");
        }

        $proxyUrl = $credentials['proxy'] ?? '';
        if (!empty($proxyUrl)) {
            putenv('ALL_PROXY=' . $proxyUrl);
            putenv('HTTPS_PROXY=' . $proxyUrl);
        }

        $region = strtolower(trim((string) ($credentials['sendgrid_region'] ?? '')));
        if ($region === 'eu') {
            $dsn = sprintf('sendgrid+api://%s@default?region=eu', urlencode($apiKey));
        } else {
            $dsn = sprintf('sendgrid+api://%s@default', urlencode($apiKey));
        }
        $transport = Transport::fromDsn($dsn);
        $this->mailer = new SymfonyMailer($transport);
    }

    /**
     * Initialise Postmark via API
     */
    private function initializePostmark(array $credentials): void
    {
        $apiKey = $credentials['api_key'] ?? '';
        
        if (empty($apiKey)) {
            throw new \Exception("La clé API Postmark est requise");
        }

        $proxyUrl = $credentials['proxy'] ?? '';
        if (!empty($proxyUrl)) {
            putenv('ALL_PROXY=' . $proxyUrl);
            putenv('HTTPS_PROXY=' . $proxyUrl);
        }

        $dsn = sprintf('postmark+api://%s@default', urlencode($apiKey));
        $transport = Transport::fromDsn($dsn);
        $this->mailer = new SymfonyMailer($transport);
    }

    /**
     * Initialise Amazon SES via API
     */
    private function initializeAmazonSES(array $credentials): void
    {
        $accessKey = trim((string)($credentials['access_key'] ?? ''));
        $secretKey = trim((string)($credentials['secret_key'] ?? ''));
        if ($accessKey === '') {
            $fromApiKey = trim((string)($credentials['api_key'] ?? ''));
            if ($fromApiKey !== '' && str_starts_with($fromApiKey, 'AKIA')) {
                $accessKey = $fromApiKey;
            }
        }
        if ($secretKey === '') {
            $secretKey = trim((string)($credentials['password'] ?? ''));
        }
        $region = trim((string)($credentials['region'] ?? ''));
        if ($region === '') {
            $region = 'eu-west-3';
        }

        if ($accessKey === '' || $secretKey === '') {
            throw new \Exception(
                'Amazon SES : renseignez l’Access Key ID (AKIA…) et la Secret Access Key IAM (droits ses:SendRawEmail ou équivalent).'
            );
        }

        $proxyUrl = $credentials['proxy'] ?? '';
        if (!empty($proxyUrl)) {
            putenv('ALL_PROXY=' . $proxyUrl);
            putenv('HTTPS_PROXY=' . $proxyUrl);
        }

        $dsn = sprintf(
            'ses+api://%s:%s@default?region=%s',
            urlencode($accessKey),
            urlencode($secretKey),
            $region
        );
        
        $transport = Transport::fromDsn($dsn);
        $this->mailer = new SymfonyMailer($transport);
    }

    /**
     * Initialise le mailer si pas déjà fait
     */
    private function ensureInitialized(): void
    {
        if (!$this->initialized) {
            $this->initializeMailer();
            $this->initialized = true;
        }
    }

    /**
     * Crée un nouvel email
     */
    public function createEmail(): Email
    {
        return new Email();
    }

    /**
     * Envoie un email
     */
    public function send(object $email): void
    {
        $this->ensureInitialized();
        
        if ($this->mailer === null) {
            throw new \Exception("Mailer non initialisé. Vérifiez votre configuration.");
        }

        // Si c'est déjà un Email Symfony, l'envoyer directement
        if ($email instanceof Email) {
            $symfonyEmail = $email;
        } else {
            // Convertir depuis l'ancien format (compatibilité)
            $symfonyEmail = $this->convertToSymfonyEmail($email);
        }
        
        try {
            $this->mailer->send($symfonyEmail);
            
            $toAddresses = $symfonyEmail->getTo();
            $toEmail = !empty($toAddresses) ? $toAddresses[0]->getAddress() : 'unknown';
            
            $this->logger->info("Email envoyé avec succès", ['to' => $toEmail]);
        } catch (\Exception $e) {
            $this->logger->error("Erreur envoi email", [
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }

    /**
     * Convertit un ancien format d'email vers Symfony Email
     */
    private function convertToSymfonyEmail(object $omnimailEmail): Email
    {
        $symfonyEmail = new Email();
        
        // From
        if (method_exists($omnimailEmail, 'getFrom')) {
            $from = $omnimailEmail->getFrom();
            if (!empty($from)) {
                if (is_array($from)) {
                    $fromEmail = $from['email'] ?? '';
                    $fromName = $from['name'] ?? '';
                } else {
                    $fromEmail = (string)$from;
                    $fromName = '';
                }
                if ($fromEmail) {
                    $symfonyEmail->from(!empty($fromName) ? new Address($fromEmail, $fromName) : $fromEmail);
                }
            }
        }
        
        // To
        if (method_exists($omnimailEmail, 'getTos')) {
            $tos = $omnimailEmail->getTos();
            foreach ($tos as $to) {
                $toEmail = is_array($to) ? ($to['email'] ?? ($to[0] ?? '')) : (string)$to;
                $toName = is_array($to) ? ($to['name'] ?? ($to[1] ?? '')) : '';
                if ($toEmail) {
                    $symfonyEmail->addTo(!empty($toName) ? new Address($toEmail, $toName) : $toEmail);
                }
            }
        }
        
        // Subject
        if (method_exists($omnimailEmail, 'getSubject')) {
            $subject = $omnimailEmail->getSubject();
            if ($subject) {
                $symfonyEmail->subject($subject);
            }
        }
        
        // Body
        if (method_exists($omnimailEmail, 'getHtmlBody')) {
            $htmlBody = $omnimailEmail->getHtmlBody();
            if ($htmlBody) {
                $symfonyEmail->html($htmlBody);
            }
        }
        
        if (method_exists($omnimailEmail, 'getTextBody')) {
            $textBody = $omnimailEmail->getTextBody();
            if ($textBody) {
                $symfonyEmail->text($textBody);
            }
        }
        
        return $symfonyEmail;
    }

    /**
     * Teste la connexion au provider
     */
    public function testConnection(): bool
    {
        try {
            $this->ensureInitialized();
            return $this->mailer !== null;
        } catch (\Exception $e) {
            $this->logger->error("Erreur test connexion", ['error' => $e->getMessage()]);
            throw $e;
        }
    }
}
