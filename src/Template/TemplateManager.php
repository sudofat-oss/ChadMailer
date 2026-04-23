<?php

namespace ChadMailer\Template;

class TemplateManager
{
    private string $templatesDir;

    /** Modèles fournis avec l’app (lus si absent du dossier utilisateur). */
    private string $bundleTemplatesDir;

    public function __construct(?string $templatesDir = null)
    {
        $this->bundleTemplatesDir = __DIR__ . '/../../templates';

        if ($templatesDir === null) {
            // Utiliser un répertoire persistant
            $homeDir = getenv('HOME') ?: (getenv('USERPROFILE') ?: (getenv('HOMEPATH') ?: ''));
            
            if ($homeDir) {
                $this->templatesDir = $homeDir . '/.chadmailer/templates';
            } else {
                // Fallback : répertoire relatif
                $this->templatesDir = __DIR__ . '/../../templates';
            }
        } else {
            $this->templatesDir = $templatesDir;
        }
        
        if (!is_dir($this->templatesDir)) {
            mkdir($this->templatesDir, 0755, true);
        }
    }

    /**
     * Charge un template par son ID
     */
    public function getTemplate(string $templateId): ?array
    {
        $file = $this->templatesDir . '/' . $templateId . '.json';
        if (!file_exists($file) && $this->templatesDir !== $this->bundleTemplatesDir) {
            $file = $this->bundleTemplatesDir . '/' . $templateId . '.json';
        }
        if (!file_exists($file)) {
            return null;
        }
        $data = json_decode(file_get_contents($file), true);
        return \is_array($data) ? $data : null;
    }

    /**
     * Charge plusieurs templates
     */
    public function getTemplates(array $templateIds): array
    {
        $templates = [];
        foreach ($templateIds as $id) {
            $template = $this->getTemplate($id);
            if ($template) {
                $templates[] = $template;
            }
        }
        return $templates;
    }

    /**
     * Retourne un template en rotation (round-robin)
     * @param array $templates Liste des templates
     * @param int $index Index de l'email actuel (0-based)
     * @param int $rotationFrequency Fréquence de rotation (nombre d'emails avant de changer de template)
     * @return array
     */
    public function getRotatedTemplate(array $templates, int $index, int $rotationFrequency = 1): array
    {
        if (empty($templates)) {
            throw new \Exception("Aucun template disponible");
        }
        
        // Calculer l'index du template en fonction de la fréquence de rotation
        // Ex: si rotationFrequency = 10, on change de template tous les 10 emails
        $templateIndex = floor($index / $rotationFrequency) % count($templates);
        
        return $templates[$templateIndex];
    }

    /**
     * Personnalise un template avec les données du destinataire
     */
    public function personalize(array $template, array $recipient): array
    {
        $html = $template['html'] ?? '';
        $text = $template['text'] ?? '';

        return [
            'html' => $this->personalizeString($html, $recipient),
            'text' => $this->personalizeString($text, $recipient)
        ];
    }

    /**
     * Fusionne les champs du destinataire (ligne CSV / TXT) avec les variables propres au template,
     * ex. {{rotate_url}} / {{url_rotate}} (liste d’URLs rotative par index d’envoi).
     *
     * @param int $emailIndex0 Index 0-based du mail dans la campagne (après filtres / ordre d’envoi)
     */
    public function mergeRecipientWithTemplateVars(array $recipient, array $template, int $emailIndex0): array
    {
        $data = $recipient;
        $urls = $template['rotate_urls'] ?? [];
        if (!\is_array($urls)) {
            $urls = [];
        }
        $clean = [];
        foreach ($urls as $u) {
            $u = trim((string) $u);
            if ($u !== '') {
                $clean[] = $u;
            }
        }
        if ($clean !== []) {
            $every = max(1, (int) ($template['rotate_url_every'] ?? 1));
            $i = (int) (floor($emailIndex0 / $every) % \count($clean));
            $picked = $clean[$i];
            $data['rotate_url'] = $picked;
            $data['url_rotate'] = $picked;
        }

        return $data;
    }

    /**
     * Remplace les variables dans une chaîne
     * Supporte {{variable}} et {variable}
     * 
     * @param string $content Contenu à personnaliser
     * @param array $data Données de remplacement
     * @return string Contenu personnalisé
     */
    public function personalizeString(string $content, array $data): string
    {
        // Gérer les variables aléatoires RANDNUM-XX, RANDALPHANUM-XX, RANDALPHA-XX
        $content = preg_replace_callback('/\{\{?(RANDNUM|RANDALPHANUM|RANDALPHA)-(\d+)\}?\}\}/i', function($matches) {
            $type = strtoupper($matches[1]);
            $length = (int)$matches[2];
            
            return match ($type) {
                'RANDNUM' => (string)random_int(pow(10, $length - 1), pow(10, $length) - 1),
                'RANDALPHA' => $this->generateRandomString($length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'),
                'RANDALPHANUM' => $this->generateRandomString($length, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'),
                default => $matches[0]
            };
        }, $content);

        // Support des variables {{variable}} et {variable}
        $patterns = [
            '/\{\{(\w+)\}\}/',  // {{variable}}
            '/\{(\w+)\}/'        // {variable}
        ];

        foreach ($patterns as $pattern) {
            $content = preg_replace_callback($pattern, function($matches) use ($data) {
                $key = strtolower($matches[1]);
                // Chercher la clé (insensible à la casse)
                foreach ($data as $dataKey => $value) {
                    if (strtolower($dataKey) === $key) {
                        return $value;
                    }
                }
                return $matches[0]; // Garder la variable si non trouvée
            }, $content);
        }

        // Variables prédéfinies
        $replacements = [
            '{{date}}' => date('d/m/Y'),
            '{{time}}' => date('H:i'),
            '{{datetime}}' => date('d/m/Y H:i'),
            '{date}' => date('d/m/Y'),
            '{time}' => date('H:i'),
            '{datetime}' => date('d/m/Y H:i'),
        ];

        return str_replace(array_keys($replacements), array_values($replacements), $content);
    }

    /**
     * Sauvegarde un template
     */
    public function saveTemplate(array $template): string
    {
        // Valider les données requises
        if (empty($template['name'])) {
            throw new \InvalidArgumentException('Le nom du template est requis');
        }
        
        if (empty($template['subject'])) {
            throw new \InvalidArgumentException('Le sujet du template est requis');
        }
        
        // S'assurer que le répertoire existe
        if (!is_dir($this->templatesDir)) {
            if (!mkdir($this->templatesDir, 0755, true)) {
                throw new \RuntimeException('Impossible de créer le répertoire des templates: ' . $this->templatesDir);
            }
        }
        
        // Générer un ID si nécessaire
        if (empty($template['id'])) {
            $template['id'] = uniqid('template_', true);
        }
        
        // Ajouter la date de création/modification
        if (empty($template['created_at'])) {
            $template['created_at'] = date('Y-m-d H:i:s');
        }
        $template['updated_at'] = date('Y-m-d H:i:s');

        // Conservation du dossier : si le champ n'est pas fourni explicitement,
        // on reprend celui du template existant (pour ne pas vider le dossier
        // lors d'un enregistrement depuis la vue dossier).
        if (!array_key_exists('folder_id', $template)) {
            $existing = $this->getTemplate((string) $template['id']);
            if ($existing !== null && isset($existing['folder_id'])) {
                $template['folder_id'] = $existing['folder_id'];
            }
        }
        // Si le dossier référencé n'existe plus, on retombe à la racine.
        if (!empty($template['folder_id'])) {
            $stillExists = false;
            foreach ($this->listFolders() as $f) {
                if ($f['id'] === $template['folder_id']) {
                    $stillExists = true;
                    break;
                }
            }
            if (!$stillExists) {
                $template['folder_id'] = null;
            }
        }
        
        $file = $this->templatesDir . '/' . $template['id'] . '.json';
        $json = json_encode($template, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        
        if ($json === false) {
            throw new \RuntimeException('Erreur lors de l\'encodage JSON: ' . json_last_error_msg());
        }
        
        $result = file_put_contents($file, $json);
        if ($result === false) {
            throw new \RuntimeException('Impossible d\'écrire le fichier template: ' . $file);
        }
        
        return $template['id'];
    }

    /**
     * Liste tous les templates
     */
    public function listTemplates(): array
    {
        $byId = [];

        $loadDir = function (string $dir) use (&$byId): void {
            if (!is_dir($dir)) {
                return;
            }
            foreach (glob($dir . '/*.json') as $file) {
                $baseName = pathinfo($file, PATHINFO_FILENAME);
                // Fichiers techniques (ex. folders.json) : ne sont pas des templates.
                if ($baseName === 'folders') {
                    continue;
                }
                $template = json_decode(file_get_contents($file), true);
                // Un template est un objet JSON associatif qui contient au moins 'name' et 'subject'.
                // Les tableaux indexés (liste de dossiers, exports, etc.) sont ignorés.
                if (!\is_array($template) || !isset($template['name'])) {
                    continue;
                }
                $id = $template['id'] ?? $baseName;
                if ($id === '') {
                    continue;
                }
                if (!isset($byId[$id])) {
                    $byId[$id] = $template;
                }
            }
        };

        $loadDir($this->templatesDir);
        if ($this->templatesDir !== $this->bundleTemplatesDir) {
            $loadDir($this->bundleTemplatesDir);
        }

        return array_values($byId);
    }

    /**
     * Supprime un template
     */
    public function deleteTemplate(string $templateId): bool
    {
        $file = $this->templatesDir . '/' . $templateId . '.json';
        if (file_exists($file)) {
            return unlink($file);
        }
        return false;
    }

    /**
     * Chemin du fichier de dossiers (persistés à côté des templates utilisateur).
     */
    private function foldersFile(): string
    {
        return $this->templatesDir . '/folders.json';
    }

    /**
     * Liste les dossiers de templates (triés par ordre d'affichage, puis nom).
     * @return array<int, array<string, mixed>>
     */
    public function listFolders(): array
    {
        $file = $this->foldersFile();
        if (!file_exists($file)) {
            return [];
        }
        $raw = file_get_contents($file);
        if ($raw === false || $raw === '') {
            return [];
        }
        $data = json_decode($raw, true);
        if (!\is_array($data)) {
            return [];
        }
        $folders = [];
        foreach ($data as $folder) {
            if (!\is_array($folder) || empty($folder['id']) || empty($folder['name'])) {
                continue;
            }
            $parentId = $folder['parent_id'] ?? null;
            if ($parentId === '' || $parentId === false) {
                $parentId = null;
            }
            $folders[] = [
                'id' => (string) $folder['id'],
                'name' => (string) $folder['name'],
                'color' => (string) ($folder['color'] ?? 'violet'),
                'parent_id' => $parentId === null ? null : (string) $parentId,
                'order' => (int) ($folder['order'] ?? 0),
                'created_at' => (string) ($folder['created_at'] ?? ''),
                'updated_at' => (string) ($folder['updated_at'] ?? ''),
            ];
        }
        usort($folders, static function ($a, $b) {
            if ($a['order'] !== $b['order']) {
                return $a['order'] <=> $b['order'];
            }
            return strcasecmp($a['name'], $b['name']);
        });
        return $folders;
    }

    /**
     * Persiste le tableau brut des dossiers.
     * @param array<int, array<string, mixed>> $folders
     */
    private function writeFolders(array $folders): void
    {
        if (!is_dir($this->templatesDir)) {
            mkdir($this->templatesDir, 0755, true);
        }
        $json = json_encode(array_values($folders), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            throw new \RuntimeException('Encodage JSON dossiers impossible: ' . json_last_error_msg());
        }
        if (file_put_contents($this->foldersFile(), $json) === false) {
            throw new \RuntimeException('Impossible d\'écrire le fichier des dossiers.');
        }
    }

    /**
     * Crée ou met à jour un dossier. Retourne l'ID.
     * @param array<string, mixed> $folder
     */
    public function saveFolder(array $folder): string
    {
        $name = trim((string) ($folder['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Nom du dossier requis.');
        }
        $id = (string) ($folder['id'] ?? '');
        $color = trim((string) ($folder['color'] ?? 'violet'));
        if ($color === '') {
            $color = 'violet';
        }

        $parentIdProvided = array_key_exists('parent_id', $folder);
        $parentId = $folder['parent_id'] ?? null;
        if ($parentId === '' || $parentId === false) {
            $parentId = null;
        }
        if ($parentId !== null) {
            $parentId = (string) $parentId;
        }

        $folders = $this->listFolders();
        $now = date('Y-m-d H:i:s');
        $found = false;

        if ($parentId !== null) {
            if ($id !== '' && $parentId === $id) {
                throw new \InvalidArgumentException('Un dossier ne peut pas être son propre parent.');
            }
            $exists = false;
            foreach ($folders as $f) {
                if ($f['id'] === $parentId) {
                    $exists = true;
                    break;
                }
            }
            if (!$exists) {
                throw new \InvalidArgumentException('Dossier parent introuvable.');
            }
            if ($id !== '' && $this->isDescendantOf($folders, $parentId, $id)) {
                throw new \InvalidArgumentException('Impossible : ce dossier parent est un descendant du dossier courant.');
            }
        }

        foreach ($folders as &$f) {
            if ($id !== '' && $f['id'] === $id) {
                $f['name'] = $name;
                $f['color'] = $color;
                if ($parentIdProvided) {
                    $f['parent_id'] = $parentId;
                }
                if (isset($folder['order'])) {
                    $f['order'] = (int) $folder['order'];
                }
                $f['updated_at'] = $now;
                $found = true;
                break;
            }
        }
        unset($f);

        if (!$found) {
            if ($id === '') {
                $id = uniqid('folder_', true);
            }
            $maxOrder = 0;
            foreach ($folders as $f) {
                if ($f['order'] > $maxOrder) {
                    $maxOrder = $f['order'];
                }
            }
            $folders[] = [
                'id' => $id,
                'name' => $name,
                'color' => $color,
                'parent_id' => $parentId,
                'order' => isset($folder['order']) ? (int) $folder['order'] : $maxOrder + 1,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $this->writeFolders($folders);
        return $id;
    }

    /**
     * Déplace un dossier sous un autre dossier (ou à la racine si $parentId === null).
     * Empêche les cycles (un dossier ne peut pas être déplacé dans un de ses descendants).
     */
    public function moveFolderToFolder(string $folderId, ?string $parentId): bool
    {
        if ($folderId === '') {
            return false;
        }
        $folders = $this->listFolders();
        $target = null;
        foreach ($folders as $f) {
            if ($f['id'] === $folderId) {
                $target = $f;
                break;
            }
        }
        if ($target === null) {
            return false;
        }

        if ($parentId === '' || $parentId === null) {
            $newParent = null;
        } else {
            $newParent = (string) $parentId;
            if ($newParent === $folderId) {
                return false;
            }
            $exists = false;
            foreach ($folders as $f) {
                if ($f['id'] === $newParent) {
                    $exists = true;
                    break;
                }
            }
            if (!$exists) {
                return false;
            }
            if ($this->isDescendantOf($folders, $newParent, $folderId)) {
                return false;
            }
        }

        $now = date('Y-m-d H:i:s');
        foreach ($folders as &$f) {
            if ($f['id'] === $folderId) {
                $f['parent_id'] = $newParent;
                $f['updated_at'] = $now;
                break;
            }
        }
        unset($f);

        $this->writeFolders($folders);
        return true;
    }

    /**
     * Vérifie si $candidateId est un descendant (à n'importe quelle profondeur) de $ancestorId.
     * @param array<int, array<string, mixed>> $folders
     */
    private function isDescendantOf(array $folders, string $candidateId, string $ancestorId): bool
    {
        $byId = [];
        foreach ($folders as $f) {
            $byId[$f['id']] = $f;
        }
        $current = $byId[$candidateId] ?? null;
        $guard = 0;
        while ($current !== null && $guard++ < 1000) {
            $parent = $current['parent_id'] ?? null;
            if ($parent === null || $parent === '') {
                return false;
            }
            if ($parent === $ancestorId) {
                return true;
            }
            $current = $byId[$parent] ?? null;
        }
        return false;
    }

    /**
     * Supprime un dossier. Les templates contenus retournent à la racine.
     */
    public function deleteFolder(string $folderId): bool
    {
        $folders = $this->listFolders();
        $target = null;
        foreach ($folders as $f) {
            if ($f['id'] === $folderId) {
                $target = $f;
                break;
            }
        }
        if ($target === null) {
            return false;
        }

        $newParentForChildren = $target['parent_id'] ?? null;
        $now = date('Y-m-d H:i:s');
        $kept = [];
        foreach ($folders as $f) {
            if ($f['id'] === $folderId) {
                continue;
            }
            if (($f['parent_id'] ?? null) === $folderId) {
                $f['parent_id'] = $newParentForChildren;
                $f['updated_at'] = $now;
            }
            $kept[] = $f;
        }
        $this->writeFolders($kept);

        foreach ($this->listTemplates() as $tpl) {
            if (($tpl['folder_id'] ?? null) === $folderId) {
                $tpl['folder_id'] = null;
                $tpl['updated_at'] = date('Y-m-d H:i:s');
                $file = $this->templatesDir . '/' . $tpl['id'] . '.json';
                $json = json_encode($tpl, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                if ($json !== false) {
                    file_put_contents($file, $json);
                }
            }
        }
        return true;
    }

    /**
     * Déplace un template dans un dossier (ou à la racine si $folderId === null).
     */
    public function moveTemplateToFolder(string $templateId, ?string $folderId): bool
    {
        $tpl = $this->getTemplate($templateId);
        if ($tpl === null) {
            return false;
        }

        if ($folderId !== null && $folderId !== '') {
            $exists = false;
            foreach ($this->listFolders() as $f) {
                if ($f['id'] === $folderId) {
                    $exists = true;
                    break;
                }
            }
            if (!$exists) {
                return false;
            }
        }

        $tpl['folder_id'] = ($folderId === null || $folderId === '') ? null : $folderId;
        $tpl['updated_at'] = date('Y-m-d H:i:s');

        if (!is_dir($this->templatesDir)) {
            mkdir($this->templatesDir, 0755, true);
        }
        $file = $this->templatesDir . '/' . $tpl['id'] . '.json';
        $json = json_encode($tpl, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            return false;
        }
        return file_put_contents($file, $json) !== false;
    }
    
    /**
     * Génère une chaîne aléatoire
     * 
     * @param int $length Longueur de la chaîne
     * @param string $chars Caractères autorisés
     * @return string Chaîne aléatoire
     */
    private function generateRandomString(int $length, string $chars): string
    {
        $result = '';
        $charsLength = strlen($chars);
        for ($i = 0; $i < $length; $i++) {
            $result .= $chars[random_int(0, $charsLength - 1)];
        }
        return $result;
    }

    public function ensurePlainText(array $template): array
    {
        if (empty(trim($template['text'] ?? ''))) {
            $html = $template['html'] ?? '';
            $text = preg_replace('/<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/i', '$2 ($1)', $html);
            $text = strip_tags($text);
            $text = preg_replace('/\s+/', ' ', $text);
            $text = trim($text);
            $template['text'] = $text;
        }
        return $template;
    }
}

