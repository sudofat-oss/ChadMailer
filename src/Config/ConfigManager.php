<?php

namespace ChadMailer\Config;

class ConfigManager
{
    private string $configFile;
    private array $config = [];

    public function __construct(?string $configFile = null)
    {
        if ($configFile === null) {
            // Utiliser un répertoire persistant pour la config
            $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: (getenv('HOMEPATH') ?: ''));
            
            if ($homeDir) {
                $configDir = $homeDir . '/.chadmailer/config';
                if (!is_dir($configDir)) {
                    mkdir($configDir, 0755, true);
                }
                $this->configFile = $configDir . '/config.php';
            } else {
                // Fallback : Détecter si on est dans un PHAR
                if (strpos(__DIR__, 'phar://') === 0) {
                    // Dans un PHAR, utiliser le répertoire temporaire si défini
                    $tmpDir = getenv('CHADMAILER_TMP_DIR');
                    if ($tmpDir && file_exists($tmpDir . '/config/config.php')) {
                        $this->configFile = $tmpDir . '/config/config.php';
                    } else {
                        $this->configFile = __DIR__ . '/../../config/config.php';
                    }
                } else {
                    $this->configFile = __DIR__ . '/../../config/config.php';
                }
            }
        } else {
            $this->configFile = $configFile;
        }
        $this->load();
    }

    /**
     * Charge la configuration
     */
    private function load(): void
    {
        if (file_exists($this->configFile)) {
            $this->config = require $this->configFile;
        } else {
            $this->config = $this->getDefaultConfig();
            $this->save();
        }
    }

    /**
     * Sauvegarde la configuration
     */
    public function save(): void
    {
        $dir = dirname($this->configFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $content = "<?php\n\nreturn " . var_export($this->config, true) . ";\n";
        file_put_contents($this->configFile, $content);
    }

    /**
     * Retourne la configuration par défaut
     */
    private function getDefaultConfig(): array
    {
        // Détecter le répertoire de base (PHAR ou normal)
        $baseDir = $this->getBaseDirectory();
        
        return [
            'mailer' => [
                'provider' => 'mailgun', // mailgun, sendgrid, amazonses, postmark
                'credentials' => [
                    'api_key' => '',
                    'domain' => '', // Pour Mailgun
                    'access_key' => '', // Pour Amazon SES
                    'secret_key' => '', // Pour Amazon SES
                    'region' => 'us-east-1' // Pour Amazon SES
                ],
                'from_email' => '',
                'from_name' => '',
                'test_email' => ''
            ],
            'campaign' => [
                'default_delay' => 1, // secondes entre chaque email
                'randomize_delay' => false,
                'max_retries' => 3
            ],
            'paths' => [
                'templates' => $baseDir . '/templates',
                'campaigns' => $baseDir . '/campaigns',
                'uploads' => $baseDir . '/uploads',
                'storage' => $baseDir . '/storage'
            ]
        ];
    }

    /**
     * Retourne le répertoire de base (détecte PHAR ou normal)
     * Utilise un répertoire persistant dans le home de l'utilisateur
     */
    private function getBaseDirectory(): string
    {
        // Utiliser un répertoire persistant dans le home de l'utilisateur
        $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: (getenv('HOMEPATH') ?: ''));
        
        if ($homeDir) {
            $dataDir = $homeDir . '/.chadmailer';
            if (!is_dir($dataDir)) {
                mkdir($dataDir, 0755, true);
            }
            return $dataDir;
        }
        
        // Fallback : Si on est dans un PHAR, utiliser le répertoire temporaire
        $tmpDir = getenv('CHADMAILER_TMP_DIR');
        if ($tmpDir && is_dir($tmpDir)) {
            return $tmpDir;
        }
        
        // Dernier recours : répertoire relatif normal
        $baseDir = __DIR__ . '/../..';
        if (!is_dir($baseDir)) {
            mkdir($baseDir, 0755, true);
        }
        return $baseDir;
    }

    /**
     * Récupère une valeur de configuration
     */
    public function get(string $key, $default = null)
    {
        $keys = explode('.', $key);
        $value = $this->config;
        
        foreach ($keys as $k) {
            if (!isset($value[$k])) {
                return $default;
            }
            $value = $value[$k];
        }
        
        return $value;
    }

    /**
     * Définit une valeur de configuration
     */
    public function set(string $key, $value): void
    {
        $keys = explode('.', $key);
        $config = &$this->config;
        
        foreach ($keys as $k) {
            if (!isset($config[$k]) || !is_array($config[$k])) {
                $config[$k] = [];
            }
            $config = &$config[$k];
        }
        
        $config = $value;
    }

    /**
     * Retourne toute la configuration
     */
    public function all(): array
    {
        return $this->config;
    }
}

