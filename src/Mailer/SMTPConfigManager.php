<?php

namespace ChadMailer\Mailer;

class SMTPConfigManager
{
    private string $configDir;

    public function __construct(?string $configDir = null)
    {
        if ($configDir === null) {
            // Utiliser un répertoire persistant
            $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: (getenv('HOMEPATH') ?: ''));
            
            if ($homeDir) {
                $this->configDir = $homeDir . '/.chadmailer/storage/smtp_configs';
            } else {
                // Fallback : répertoire relatif
                $this->configDir = __DIR__ . '/../../storage/smtp_configs';
            }
        } else {
            $this->configDir = $configDir;
        }
        
        if (!is_dir($this->configDir)) {
            mkdir($this->configDir, 0755, true);
        }
    }

    /**
     * Sauvegarde une configuration SMTP
     */
    public function saveConfig(array $config): string
    {
        $isUpdate = !empty($config['id']);
        
        if (!$isUpdate) {
            $config['id'] = uniqid('smtp_', true);
            $config['created_at'] = date('Y-m-d H:i:s');
        } else {
            // Si c'est une mise à jour, charger l'ancienne config pour préserver created_at et les secrets si non fournis
            $existingConfig = $this->loadConfig($config['id']);
            if ($existingConfig) {
                $config['created_at'] = $existingConfig['created_at'];
                $apiKey = trim((string)($config['api_key'] ?? ''));
                if ($apiKey === '' || $apiKey === '***') {
                    $config['api_key'] = $existingConfig['api_key'] ?? '';
                }
                $pass = trim((string)($config['password'] ?? ''));
                if ($pass === '' || $pass === '***') {
                    $config['password'] = $existingConfig['password'] ?? '';
                }
                $accessKey = trim((string)($config['access_key'] ?? ''));
                if ($accessKey === '' || $accessKey === '***') {
                    $config['access_key'] = $existingConfig['access_key'] ?? '';
                }
                $secretKey = trim((string)($config['secret_key'] ?? ''));
                if ($secretKey === '' || $secretKey === '***') {
                    $config['secret_key'] = $existingConfig['secret_key'] ?? '';
                }
                $region = trim((string)($config['region'] ?? ''));
                if ($region === '') {
                    $config['region'] = $existingConfig['region'] ?? 'eu-west-3';
                }
                if (strtolower((string)($config['provider'] ?? '')) === 'sendgrid' && !\array_key_exists('sendgrid_region', $config)) {
                    $config['sendgrid_region'] = $existingConfig['sendgrid_region'] ?? '';
                }
            }
        }
        
        if (empty($config['name'])) {
            $config['name'] = 'SMTP ' . date('Y-m-d H:i:s');
        }

        $provLower = strtolower((string) ($config['provider'] ?? ''));
        if ($provLower !== 'sendgrid') {
            unset($config['sendgrid_region']);
        }
        if ($provLower === 'office365') {
            if (trim((string) ($config['host'] ?? '')) === '') {
                $config['host'] = 'smtp.office365.com';
            }
            $p = (int) ($config['port'] ?? 587);
            if ($p <= 0) {
                $config['port'] = 587;
            }
            if (trim((string) ($config['encryption'] ?? '')) === '') {
                $config['encryption'] = 'tls';
            }
        }
        
        $config['updated_at'] = date('Y-m-d H:i:s');

        $config = $this->enrichWithRemoteSnapshot($config);

        $this->persistConfig($config);

        return $config['id'];
    }

    /**
     * Met à jour uniquement remote_snapshot (sans refaire enrich sur enregistrement complet).
     *
     * @param array<string, mixed> $snapshot
     */
    public function writeRemoteSnapshot(string $id, array $snapshot): void
    {
        $config = $this->loadConfig($id);
        if ($config === null) {
            return;
        }
        $config['remote_snapshot'] = $snapshot;
        $config['updated_at'] = date('Y-m-d H:i:s');
        $this->persistConfig($config);
    }

    /**
     * Reconstruit remote_snapshot depuis les identifiants enregistrés (après « Interroger l’API » ou outil).
     */
    public function refreshRemoteSnapshot(string $id): bool
    {
        $config = $this->loadConfig($id);
        if ($config === null) {
            return false;
        }
        $config = $this->enrichWithRemoteSnapshot($config);
        $this->persistConfig($config);

        return true;
    }

    /**
     * @param array<string, mixed> $config
     *
     * @return array<string, mixed>
     */
    private function enrichWithRemoteSnapshot(array $config): array
    {
        $p = strtolower((string) ($config['provider'] ?? ''));
        if (!\in_array($p, ['brevo', 'ses', 'amazonses', 'sendgrid'], true)) {
            return $config;
        }
        try {
            $snap = (new SmtpRemoteSnapshotBuilder())->build($config);
            if ($snap !== null) {
                $config['remote_snapshot'] = $snap;
            }
        } catch (\Throwable $e) {
            $config['remote_snapshot'] = [
                'provider' => $p,
                'fetched_at' => (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format(\DateTimeInterface::ATOM),
                'quotas' => ['lines' => []],
                'dns_badges' => [
                    'spf' => 'unknown',
                    'dkim' => 'unknown',
                    'dmarc' => 'unknown',
                    'hint' => $e->getMessage(),
                ],
                'errors' => [$e->getMessage()],
            ];
        }

        return $config;
    }

    /**
     * @param array<string, mixed> $config
     */
    private function persistConfig(array $config): void
    {
        $file = $this->configDir . '/' . $config['id'] . '.json';
        file_put_contents($file, json_encode($config, JSON_PRETTY_PRINT));
    }

    /**
     * Charge une configuration SMTP
     */
    public function loadConfig(string $id): ?array
    {
        $file = $this->configDir . '/' . $id . '.json';
        if (!file_exists($file)) {
            return null;
        }
        return json_decode(file_get_contents($file), true);
    }

    /**
     * Liste toutes les configurations SMTP
     */
    public function listConfigs(): array
    {
        $configs = [];
        if (is_dir($this->configDir)) {
            foreach (glob($this->configDir . '/*.json') as $file) {
                $config = json_decode(file_get_contents($file), true);
                if ($config) {
                    // Ne pas exposer les mots de passe dans la liste
                    if (isset($config['password'])) {
                        $config['password'] = '***';
                    }
                    if (isset($config['secret_key'])) {
                        $config['secret_key'] = '***';
                    }
                    if (isset($config['api_key']) && \is_string($config['api_key']) && strlen($config['api_key']) > 6) {
                        $config['api_key'] = '***';
                    }
                    $configs[] = $config;
                }
            }
        }
        return $configs;
    }

    /**
     * Supprime une configuration
     */
    public function deleteConfig(string $id): bool
    {
        $file = $this->configDir . '/' . $id . '.json';
        if (file_exists($file)) {
            return unlink($file);
        }
        return false;
    }
}

