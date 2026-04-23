<?php

/**
 * Script de build pour créer un PHAR exécutable
 */

$pharFile = 'chadmailer.phar';

// Vérifier que vendor existe
if (!is_dir(__DIR__ . '/vendor')) {
    echo "❌ Erreur: Le dossier vendor n'existe pas.\n";
    echo "Exécutez d'abord: composer install --no-dev --optimize-autoloader\n";
    exit(1);
}

// Supprimer l'ancien PHAR si il existe
if (file_exists($pharFile)) {
    unlink($pharFile);
}

echo "📦 Création du PHAR...\n";

$phar = new Phar($pharFile);

// Début de la création du PHAR
$phar->startBuffering();

// Ajouter tous les fichiers du projet (INCLURE vendor cette fois)
echo "📂 Ajout des fichiers...\n";
$phar->buildFromDirectory(__DIR__, '/^(?!.*(node_modules|\.git|\.idea|build\.php|\.phar|\.phar\.gz|examples)).*$/');

// Définir le stub (point d'entrée)
$stub = <<<'STUB'
#!/usr/bin/env php
<?php
Phar::mapPhar('chadmailer.phar');

// Obtenir le chemin du PHAR (utiliser __FILE__ qui contient le chemin complet)
$pharPath = __FILE__;
$pharUrl = 'phar://' . $pharPath;
putenv('CHADMAILER_PHAR_PATH=' . $pharPath);

// Créer un répertoire temporaire pour extraire les fichiers
$tmpDir = sys_get_temp_dir() . '/chadmailer_' . uniqid();
mkdir($tmpDir, 0755, true);
$publicDir = $tmpDir . '/public';
mkdir($publicDir, 0755, true);

// Fonction pour extraire récursivement un dossier du PHAR
function extractFromPhar($pharUrl, $sourcePath, $targetPath) {
    $fullSource = $pharUrl . '/' . $sourcePath;
    if (!is_dir($fullSource)) {
        return false;
    }
    
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($fullSource, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    
    $sourcePathLength = strlen($fullSource) + 1;
    $extracted = false;
    
    foreach ($iterator as $item) {
        $itemPath = $item->getPathname();
        $relativePath = substr($itemPath, $sourcePathLength);
        $target = $targetPath . '/' . $relativePath;
        
        if ($item->isDir()) {
            if (!is_dir($target)) {
                mkdir($target, 0755, true);
            }
        } else {
            $targetDir = dirname($target);
            if (!is_dir($targetDir)) {
                mkdir($targetDir, 0755, true);
            }
            $content = file_get_contents($itemPath);
            if ($content !== false) {
                file_put_contents($target, $content);
                $extracted = true;
            }
        }
    }
    
    return $extracted;
}

function extractSingleFileFromPhar($pharUrl, $sourceFile, $targetFile) {
    $fullSource = $pharUrl . '/' . $sourceFile;
    if (!file_exists($fullSource)) {
        return false;
    }
    $targetDir = dirname($targetFile);
    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0755, true);
    }
    $content = file_get_contents($fullSource);
    if ($content === false) {
        return false;
    }
    file_put_contents($targetFile, $content);
    return true;
}

// Extraire vendor (nécessaire pour autoload)
$vendorExtracted = extractFromPhar($pharUrl, 'vendor', $tmpDir . '/vendor');
if (!$vendorExtracted) {
    echo "⚠️  Attention: Impossible d'extraire vendor, vérifiez le PHAR\n";
}

// Extraire src (nécessaire pour les classes de l'application)
$srcExtracted = extractFromPhar($pharUrl, 'src', $tmpDir . '/src');
if (!$srcExtracted) {
    echo "⚠️  Attention: Impossible d'extraire src, vérifiez le PHAR\n";
}

// Extraire public
extractFromPhar($pharUrl, 'public', $publicDir);

// Extraire cli.php pour permettre le worker background même hors contexte PHAR direct
$cliExtracted = extractSingleFileFromPhar($pharUrl, 'cli.php', $tmpDir . '/cli.php');
if (!$cliExtracted) {
    echo "⚠️  Attention: Impossible d'extraire cli.php, le mode background peut échouer\n";
}

// Copier le fichier de config
$configSource = $pharUrl . '/config/config.php';
$configTarget = $tmpDir . '/config';
if (!is_dir($configTarget)) {
    mkdir($configTarget, 0755, true);
}
if (file_exists($configSource)) {
    file_put_contents($configTarget . '/config.php', file_get_contents($configSource));
}

// Créer les dossiers de travail dans le répertoire temporaire
$workDirs = ['templates', 'campaigns', 'uploads', 'storage'];
foreach ($workDirs as $dir) {
    $workDir = $tmpDir . '/' . $dir;
    if (!is_dir($workDir)) {
        mkdir($workDir, 0755, true);
    }
}

// Modifier index.php pour utiliser le vendor extrait
$indexPhpPath = $publicDir . '/index.php';
if (file_exists($indexPhpPath)) {
    $indexPhp = file_get_contents($indexPhpPath);
    
    // Remplacer le chemin autoload pour utiliser le vendor extrait
    $indexPhp = str_replace(
        "require_once __DIR__ . '/../vendor/autoload.php';",
        "require_once __DIR__ . '/../vendor/autoload.php';",
        $indexPhp
    );
    
    // Définir la variable d'environnement pour ConfigManager
    $indexPhp = str_replace(
        "require_once __DIR__ . '/../vendor/autoload.php';",
        "require_once __DIR__ . '/../vendor/autoload.php';\nputenv('CHADMAILER_TMP_DIR={$tmpDir}');",
        $indexPhp
    );
    
    // Remplacer le chemin de config dans l'instanciation de ConfigManager
    $indexPhp = preg_replace(
        "/new ConfigManager\(\)/",
        "new ConfigManager('{$tmpDir}/config/config.php')",
        $indexPhp
    );
    
    file_put_contents($indexPhpPath, $indexPhp);
}

// Lancer le serveur intégré
$port = $argv[1] ?? 8000;
$host = $argv[2] ?? 'localhost';

echo "🚀 ChadMailer - Serveur de développement\n";
echo "📡 Serveur démarré sur http://{$host}:{$port}\n";
echo "💡 Ouvrez votre navigateur : http://{$host}:{$port}/index.html\n";
echo "📁 Répertoire temporaire : {$tmpDir}\n";
echo "⏹️  Appuyez sur Ctrl+C pour arrêter\n\n";

// Nettoyer à la fin (optionnel - commenté pour garder les fichiers)
register_shutdown_function(function() use ($tmpDir) {
    // Décommenter pour nettoyer automatiquement
    // if (is_dir($tmpDir)) {
    //     system("rm -rf " . escapeshellarg($tmpDir));
    // }
});

$command = sprintf(
    'php -S %s:%d -t %s',
    $host,
    $port,
    $publicDir
);

passthru($command);
__HALT_COMPILER();
STUB;

$phar->setStub($stub);
$phar->stopBuffering();

// Rendre exécutable (Unix)
chmod($pharFile, 0755);

$size = round(filesize($pharFile) / 1024 / 1024, 2);
echo "✅ PHAR créé avec succès : {$pharFile}\n";
echo "📊 Taille : {$size} MB\n";
echo "\n💡 Pour l'exécuter : php {$pharFile}\n";

