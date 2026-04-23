<?php

namespace ChadMailer\CSV;

use League\Csv\Reader;
use League\Csv\Exception;

class CSVParser
{
    /**
     * Parse un fichier CSV et retourne un tableau de destinataires
     */
    public function parse(string $csvPath): array
    {
        if (!file_exists($csvPath)) {
            throw new \Exception("Fichier CSV introuvable: {$csvPath}");
        }

        try {
            $csv = Reader::createFromPath($csvPath, 'r');
            $csv->setHeaderOffset(0); // Première ligne = en-têtes
            
            $records = [];
            foreach ($csv->getRecords() as $record) {
                // Normaliser les clés (minuscules, sans espaces)
                $normalized = [];
                foreach ($record as $key => $value) {
                    $normalizedKey = strtolower(trim(str_replace(' ', '_', $key)));
                    $normalized[$normalizedKey] = trim($value);
                }
                
                // S'assurer qu'on a au moins un email
                if (empty($normalized['email']) && empty($normalized['e-mail'])) {
                    continue; // Ignorer les lignes sans email
                }
                
                // Normaliser la clé email
                if (isset($normalized['e-mail'])) {
                    $normalized['email'] = $normalized['e-mail'];
                    unset($normalized['e-mail']);
                }
                
                $records[] = $normalized;
            }
            
            return $records;
        } catch (Exception $e) {
            throw new \Exception("Erreur lors du parsing CSV: " . $e->getMessage());
        }
    }

    /**
     * Valide la structure d'un CSV
     */
    public function validate(string $csvPath): array
    {
        $errors = [];
        $warnings = [];

        if (!file_exists($csvPath)) {
            $errors[] = "Fichier introuvable";
            return ['valid' => false, 'errors' => $errors, 'warnings' => $warnings];
        }

        try {
            $csv = Reader::createFromPath($csvPath, 'r');
            $csv->setHeaderOffset(0);
            
            $headers = $csv->getHeader();
            $headerLower = array_map('strtolower', $headers);
            
            // Vérifier la présence d'une colonne email
            $hasEmail = in_array('email', $headerLower) || in_array('e-mail', $headerLower);
            if (!$hasEmail) {
                $errors[] = "Aucune colonne 'email' ou 'e-mail' trouvée";
            }

            // Compter les lignes
            $count = count($csv);
            if ($count === 0) {
                $warnings[] = "Le fichier ne contient aucune donnée";
            }

            return [
                'valid' => empty($errors),
                'errors' => $errors,
                'warnings' => $warnings,
                'rows' => $count,
                'headers' => $headers
            ];
        } catch (Exception $e) {
            $errors[] = "Erreur de lecture: " . $e->getMessage();
            return ['valid' => false, 'errors' => $errors, 'warnings' => $warnings];
        }
    }
}

