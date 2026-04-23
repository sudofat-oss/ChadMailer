<?php

namespace ChadMailer\CSV;

use League\Csv\Reader;
use League\Csv\Exception;

class RecipientParser
{
    /**
     * Première ligne du CSV = en-têtes (noms de colonnes exacts tels que dans le fichier).
     */
    public function peekCsvHeaders(string $filePath): array
    {
        if (!file_exists($filePath)) {
            throw new \Exception("Fichier introuvable: {$filePath}");
        }
        $csv = Reader::createFromPath($filePath, 'r');
        $csv->setHeaderOffset(0);

        return $csv->getHeader();
    }

    /**
     * Parse un fichier (TXT ou CSV) et retourne un tableau de destinataires
     *
     * @param string $filePath Chemin du fichier
     * @param string $fileType Type de fichier (txt ou csv)
     * @param array|null $columnMapping Mapping des colonnes pour CSV (clé "email" = nom exact colonne)
     * @return array Tableau de destinataires
     * @throws \Exception Si le fichier n'existe pas ou le type n'est pas supporté
     */
    public function parse(string $filePath, string $fileType, ?array $columnMapping = null): array
    {
        if (!file_exists($filePath)) {
            throw new \Exception("Fichier introuvable: {$filePath}");
        }

        return match ($fileType) {
            'txt' => $this->parseTxt($filePath),
            'csv' => $this->parseCsv($filePath, $columnMapping),
            default => throw new \Exception("Type de fichier non supporté: {$fileType}. Utilisez un fichier CSV ou TXT.")
        };
    }

    /**
     * Parse un fichier TXT (un email par ligne)
     */
    private function parseTxt(string $filePath): array
    {
        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $recipients = [];

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            $email = null;
            $firstName = null;
            $lastName = null;

            // Format SenderbonV2 / liste : prenom/nom/email@domaine.com
            if (str_contains($line, '/') && substr_count($line, '/') >= 2) {
                $parts = array_map('trim', explode('/', $line, 3));
                if (\count($parts) === 3 && filter_var($parts[2], FILTER_VALIDATE_EMAIL)) {
                    $firstName = $parts[0];
                    $lastName = $parts[1];
                    $email = strtolower($parts[2]);
                }
            }

            if ($email === null && filter_var($line, FILTER_VALIDATE_EMAIL)) {
                $email = strtolower($line);
            }

            if ($email !== null) {
                $row = ['email' => $email];
                if ($firstName !== null && $lastName !== null) {
                    $row['first_name'] = $firstName;
                    $row['last_name'] = $lastName;
                    $row['name'] = trim($firstName . ' ' . $lastName);
                }
                $this->addNameAliases($row);
                $recipients[] = $row;
            }
        }

        return $recipients;
    }

    /**
     * Mapping explicite : colonne email obligatoire dans column_mapping.
     */
    private function usesExplicitCsvMapping(?array $columnMapping): bool
    {
        return is_array($columnMapping)
            && isset($columnMapping['email'])
            && is_string($columnMapping['email'])
            && trim($columnMapping['email']) !== '';
    }

    /**
     * Parse un fichier CSV avec mapping de colonnes
     */
    private function parseCsv(string $filePath, ?array $columnMapping = null): array
    {
        try {
            $csv = Reader::createFromPath($filePath, 'r');
            $csv->setHeaderOffset(0); // Première ligne = en-têtes

            $records = [];
            $explicit = $this->usesExplicitCsvMapping($columnMapping);

            foreach ($csv->getRecords() as $record) {
                $recipient = $explicit
                    ? $this->mapCsvRowExplicit($record, $columnMapping)
                    : $this->mapCsvRowAuto($record);

                if (empty($recipient['email']) || !filter_var($recipient['email'], FILTER_VALIDATE_EMAIL)) {
                    continue;
                }

                $recipient['email'] = strtolower(trim($recipient['email']));
                $this->addNameAliases($recipient);
                $records[] = $recipient;
            }

            return $records;
        } catch (Exception $e) {
            throw new \Exception('Erreur lors du parsing CSV: ' . $e->getMessage());
        }
    }

    /**
     * Colonnes du CSV copiées telles quelles avec clés normalisées (comportement historique).
     */
    private function mapCsvRowAuto(array $record): array
    {
        $recipient = [];
        foreach ($record as $key => $value) {
            $normalizedKey = strtolower(trim(str_replace(' ', '_', (string) $key)));
            $recipient[$normalizedKey] = trim((string) $value);
        }

        if (isset($recipient['e-mail'])) {
            $recipient['email'] = $recipient['e-mail'];
            unset($recipient['e-mail']);
        }

        return $recipient;
    }

    /**
     * Mapping défini dans l’UI campagne : email + champs optionnels + custom_variables.
     */
    private function mapCsvRowExplicit(array $record, array $columnMapping): array
    {
        $recipient = [];

        $emailCol = trim((string) $columnMapping['email']);
        if ($emailCol !== '' && isset($record[$emailCol])) {
            $recipient['email'] = trim((string) $record[$emailCol]);
        }

        $optionalStandard = ['first_name', 'last_name', 'name', 'prenom', 'nom'];
        foreach ($optionalStandard as $key) {
            if (!isset($columnMapping[$key]) || !is_string($columnMapping[$key])) {
                continue;
            }
            $col = trim($columnMapping[$key]);
            if ($col === '' || !isset($record[$col])) {
                continue;
            }
            $recipient[$key] = trim((string) $record[$col]);
        }

        $custom = $columnMapping['custom_variables'] ?? null;
        if (is_array($custom)) {
            foreach ($custom as $varName => $sourceColumn) {
                if (!is_string($sourceColumn) || trim($sourceColumn) === '') {
                    continue;
                }
                $norm = $this->normalizeVariableName((string) $varName);
                if ($norm === '' || !isset($record[$sourceColumn])) {
                    continue;
                }
                $recipient[$norm] = trim((string) $record[$sourceColumn]);
            }
        }

        return $recipient;
    }

    private function normalizeVariableName(string $raw): string
    {
        $s = strtolower(trim(preg_replace('/\s+/', '_', $raw)));
        $s = preg_replace('/[^a-z0-9_]/', '_', $s);
        $s = trim((string) $s, '_');

        return $s;
    }

    /**
     * Alias FR / EN pour les lettres ({{prenom}}, {{nom}}, etc.)
     */
    private function addNameAliases(array &$recipient): void
    {
        if (isset($recipient['first_name']) && !isset($recipient['prenom'])) {
            $recipient['prenom'] = $recipient['first_name'];
        }
        if (isset($recipient['last_name']) && !isset($recipient['nom'])) {
            $recipient['nom'] = $recipient['last_name'];
        }
        if (isset($recipient['name'])) {
            if (!isset($recipient['nom_complet'])) {
                $recipient['nom_complet'] = $recipient['name'];
            }
            if (!isset($recipient['full_name'])) {
                $recipient['full_name'] = $recipient['name'];
            }
        }
    }

    /**
     * Valide un fichier
     */
    public function validate(string $filePath, string $fileType): array
    {
        $errors = [];
        $warnings = [];

        if (!file_exists($filePath)) {
            $errors[] = 'Fichier introuvable';

            return ['valid' => false, 'errors' => $errors, 'warnings' => $warnings];
        }

        if ($fileType === 'txt') {
            return $this->validateTxt($filePath);
        }
        if ($fileType === 'csv') {
            return $this->validateCsv($filePath);
        }

        $errors[] = "Type de fichier non supporté: {$fileType}";

        return ['valid' => false, 'errors' => $errors, 'warnings' => $warnings];
    }

    /**
     * Valide un fichier TXT
     */
    private function validateTxt(string $filePath): array
    {
        $errors = [];
        $warnings = [];

        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $validEmails = 0;
        $invalidEmails = 0;

        foreach ($lines as $lineNum => $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            $ok = false;
            if (str_contains($line, '/') && substr_count($line, '/') >= 2) {
                $parts = array_map('trim', explode('/', $line, 3));
                if (\count($parts) === 3 && filter_var($parts[2], FILTER_VALIDATE_EMAIL)) {
                    $ok = true;
                }
            } elseif (filter_var($line, FILTER_VALIDATE_EMAIL)) {
                $ok = true;
            }

            if ($ok) {
                $validEmails++;
            } else {
                $invalidEmails++;
                $warnings[] = 'Ligne ' . ($lineNum + 1) . ": Email invalide ou format non reconnu '{$line}'";
            }
        }

        if ($validEmails === 0) {
            $errors[] = 'Aucun email valide trouvé dans le fichier';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'warnings' => $warnings,
            'rows' => $validEmails,
            'invalid_rows' => $invalidEmails,
        ];
    }

    /**
     * Valide un fichier CSV
     */
    private function validateCsv(string $filePath): array
    {
        $errors = [];
        $warnings = [];

        try {
            $csv = Reader::createFromPath($filePath, 'r');
            $csv->setHeaderOffset(0);

            $headers = $csv->getHeader();
            $headerLower = array_map('strtolower', $headers);

            $hasEmail = in_array('email', $headerLower, true) || in_array('e-mail', $headerLower, true);
            if (!$hasEmail) {
                $warnings[] = "Aucune colonne nommée exactement « email » ou « e-mail » — choisissez la colonne des adresses après l'import.";
            }

            $count = count($csv);
            if ($count === 0) {
                $warnings[] = 'Le fichier ne contient aucune donnée';
            }

            return [
                'valid' => empty($errors),
                'errors' => $errors,
                'warnings' => $warnings,
                'rows' => $count,
                'headers' => $headers,
            ];
        } catch (Exception $e) {
            $errors[] = 'Erreur de lecture: ' . $e->getMessage();

            return ['valid' => false, 'errors' => $errors, 'warnings' => $warnings];
        }
    }

    public function groupByDomain(array $recipients): array
    {
        $domains = [];
        foreach ($recipients as $r) {
            $email = strtolower($r['email'] ?? '');
            $parts = explode('@', $email);
            if (count($parts) === 2) {
                $domain = $parts[1];
                $domains[$domain] = ($domains[$domain] ?? 0) + 1;
            }
        }
        arsort($domains);

        return $domains;
    }

    public function filterByDomains(array $recipients, array $allowed, bool $gmailLast = false): array
    {
        if (!empty($allowed)) {
            $recipients = array_values(array_filter($recipients, function ($r) use ($allowed) {
                $email = strtolower($r['email'] ?? '');
                $parts = explode('@', $email);

                return count($parts) === 2 && in_array($parts[1], $allowed, true);
            }));
        }

        if ($gmailLast) {
            $gmail = [];
            $others = [];
            foreach ($recipients as $r) {
                $email = strtolower($r['email'] ?? '');
                if (str_ends_with($email, '@gmail.com')) {
                    $gmail[] = $r;
                } else {
                    $others[] = $r;
                }
            }
            $recipients = array_merge($others, $gmail);
        }

        return $recipients;
    }

    public function deduplicate(array $recipients): array
    {
        $seen = [];
        $deduped = [];
        foreach ($recipients as $r) {
            $key = md5(strtolower($r['email'] ?? ''));
            if (!isset($seen[$key])) {
                $seen[$key] = true;
                $deduped[] = $r;
            }
        }

        return [
            'recipients' => $deduped,
            'duplicates_removed' => count($recipients) - count($deduped),
        ];
    }
}
