<?php

namespace ChadMailer\Scoring;

class CampaignScorer
{
    private const MAX_HTML_BYTES = 102 * 1024;
    private const MAX_SUBJECT_LENGTH = 60;
    private const FREE_DOMAINS = ['gmail.com', 'yahoo.com', 'yahoo.fr', 'hotmail.com',
        'hotmail.fr', 'outlook.com', 'live.com', 'live.fr', 'aol.com', 'icloud.com',
        'me.com', 'msn.com', 'free.fr', 'orange.fr', 'sfr.fr', 'laposte.net'];
    private const URL_SHORTENERS = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly',
        'buff.ly', 'dlvr.it', 'ift.tt', 'tiny.cc', 'is.gd', 'cutt.ly'];

    public function score(array $campaign, array $template): array
    {
        $issues = [];
        $ok = [];
        $totalScore = 100;

        $subject = $campaign['subject'] ?? ($template['subject'] ?? '');
        $html = $template['html'] ?? '';
        $text = $template['text'] ?? '';
        $fromEmail = $campaign['from_email'] ?? '';
        $unsubUrl = $campaign['unsubscribe_url'] ?? '';

        // Critère 1: Spam words dans l'objet (−20 pts max)
        $subjectAnalysis = SpamWordList::analyze($subject);
        if ($subjectAnalysis['count'] > 0) {
            $penalty = min(20, $subjectAnalysis['count'] * 10);
            $totalScore -= $penalty;
            $issues[] = [
                'severity' => $penalty >= 15 ? 'critical' : 'warning',
                'criterion' => 'spam_subject',
                'message' => 'Mots spam détectés dans l\'objet : ' . implode(', ', array_slice($subjectAnalysis['found'], 0, 3)),
                'fix' => 'Remplace "' . ($subjectAnalysis['found'][0] ?? '') . '" par une formulation neutre.',
                'score_impact' => -$penalty,
            ];
        } else {
            $ok[] = ['criterion' => 'spam_subject', 'message' => 'Objet : aucun mot spam détecté'];
        }

        // Critère 2: Spam words dans le corps (−10 pts max)
        $plainText = strip_tags($html);
        $bodyAnalysis = SpamWordList::analyze($plainText);
        if ($bodyAnalysis['count'] > 2) {
            $penalty = min(10, ($bodyAnalysis['count'] - 2) * 3);
            $totalScore -= $penalty;
            $issues[] = [
                'severity' => 'warning',
                'criterion' => 'spam_body',
                'message' => $bodyAnalysis['count'] . ' occurrences de mots spam dans le corps',
                'fix' => 'Révise les termes : ' . implode(', ', array_slice($bodyAnalysis['found'], 0, 3)),
                'score_impact' => -$penalty,
            ];
        } else {
            $ok[] = ['criterion' => 'spam_body', 'message' => 'Corps : faible densité de mots spam'];
        }

        // Critère 3: Ratio texte/images (−15 pts)
        $imgCount = substr_count($html, '<img');
        $textLength = strlen(trim(strip_tags($html)));
        if ($imgCount > 0 && $textLength < 200) {
            $totalScore -= 15;
            $issues[] = [
                'severity' => 'critical',
                'criterion' => 'text_image_ratio',
                'message' => 'Trop peu de texte par rapport aux images (' . $textLength . ' chars pour ' . $imgCount . ' image(s))',
                'fix' => 'Ajoute au moins 400 caractères de texte HTML. Vise 70% texte / 30% images.',
                'score_impact' => -15,
            ];
        } elseif ($imgCount > 0 && $textLength < 400) {
            $totalScore -= 7;
            $issues[] = [
                'severity' => 'warning',
                'criterion' => 'text_image_ratio',
                'message' => 'Ratio texte/images limite (' . $textLength . ' chars)',
                'fix' => 'Ajoute du texte supplémentaire pour atteindre au moins 400 caractères.',
                'score_impact' => -7,
            ];
        } else {
            $ok[] = ['criterion' => 'text_image_ratio', 'message' => 'Ratio texte/images correct'];
        }

        // Critère 4: Taille HTML (−10 pts)
        $htmlSize = strlen($html);
        if ($htmlSize > self::MAX_HTML_BYTES) {
            $totalScore -= 10;
            $kb = round($htmlSize / 1024, 1);
            $issues[] = [
                'severity' => 'critical',
                'criterion' => 'html_size',
                'message' => 'HTML trop lourd : ' . $kb . 'KB (max 102KB)',
                'fix' => 'Gmail coupe les emails > 102KB. Supprime les styles inline redondants, optimise les images.',
                'score_impact' => -10,
            ];
        } else {
            $kb = round($htmlSize / 1024, 1);
            $ok[] = ['criterion' => 'html_size', 'message' => 'Taille HTML : ' . $kb . 'KB (OK)'];
        }

        // Critère 5: Multipart plain text (−10 pts)
        if (strlen(trim($text)) < 100) {
            $totalScore -= 10;
            $issues[] = [
                'severity' => 'critical',
                'criterion' => 'multipart',
                'message' => 'Version texte plain absente ou trop courte',
                'fix' => 'Active la génération automatique du texte plain dans les paramètres du template.',
                'score_impact' => -10,
            ];
        } else {
            $ok[] = ['criterion' => 'multipart', 'message' => 'Version texte plain présente'];
        }

        // Critère 6: Header List-Unsubscribe (−15 pts)
        if (empty($unsubUrl)) {
            $totalScore -= 15;
            $issues[] = [
                'severity' => 'critical',
                'criterion' => 'unsubscribe',
                'message' => 'URL de désabonnement non configurée',
                'fix' => 'Configure une URL de désabonnement dans Config pour activer le one-click Gmail.',
                'score_impact' => -15,
            ];
        } else {
            $ok[] = ['criterion' => 'unsubscribe', 'message' => 'URL de désabonnement configurée'];
        }

        // Critère 7: Liens suspects (−10 pts)
        preg_match_all('/https?:\/\/([^\/\s"\'<>]+)/i', $html, $urlMatches);
        $urls = $urlMatches[0] ?? [];
        $shortenerFound = [];
        $httpLinks = 0;
        $domains = [];
        foreach ($urls as $url) {
            foreach (self::URL_SHORTENERS as $shortener) {
                if (str_contains($url, $shortener)) {
                    $shortenerFound[] = $shortener;
                }
            }
            if (str_starts_with($url, 'http://')) {
                $httpLinks++;
            }
            preg_match('/https?:\/\/([^\/\s"\'<>]+)/i', $url, $dm);
            if (isset($dm[1])) {
                $domains[] = $dm[1];
            }
        }
        $uniqueDomains = count(array_unique($domains));
        $linkPenalty = 0;
        $linkIssues = [];
        if (!empty($shortenerFound)) {
            $linkPenalty += 6;
            $linkIssues[] = 'Raccourcisseurs d\'URL détectés : ' . implode(', ', array_unique($shortenerFound));
        }
        if ($httpLinks > 0) {
            $linkPenalty += 2;
            $linkIssues[] = $httpLinks . ' lien(s) HTTP non sécurisé(s)';
        }
        if ($uniqueDomains > 4) {
            $linkPenalty += 2;
            $linkIssues[] = $uniqueDomains . ' domaines différents dans les liens';
        }
        if ($linkPenalty > 0) {
            $totalScore -= min(10, $linkPenalty);
            $issues[] = [
                'severity' => $linkPenalty >= 6 ? 'critical' : 'warning',
                'criterion' => 'links',
                'message' => implode(' | ', $linkIssues),
                'fix' => 'Utilise des URLs complètes HTTPS sur ton domaine. Évite bit.ly etc.',
                'score_impact' => -min(10, $linkPenalty),
            ];
        } else {
            $ok[] = ['criterion' => 'links', 'message' => 'Liens : HTTPS, pas de raccourcisseurs'];
        }

        // Critère 8: Longueur de l'objet (−5 pts)
        $subjectLen = mb_strlen($subject);
        if ($subjectLen > self::MAX_SUBJECT_LENGTH) {
            $totalScore -= 5;
            $issues[] = [
                'severity' => 'warning',
                'criterion' => 'subject_length',
                'message' => 'Objet trop long : ' . $subjectLen . ' caractères (max ' . self::MAX_SUBJECT_LENGTH . ')',
                'fix' => 'Raccourcis l\'objet pour qu\'il soit lisible sur mobile.',
                'score_impact' => -5,
            ];
        } else {
            $ok[] = ['criterion' => 'subject_length', 'message' => 'Longueur objet : ' . $subjectLen . ' chars (OK)'];
        }

        // Critère 9: From sur domaine libre (−5 pts)
        $fromDomain = strtolower(substr(strrchr($fromEmail, '@'), 1));
        if (in_array($fromDomain, self::FREE_DOMAINS, true)) {
            $totalScore -= 5;
            $issues[] = [
                'severity' => 'critical',
                'criterion' => 'from_domain',
                'message' => 'Adresse From sur domaine libre (@' . $fromDomain . ')',
                'fix' => 'Utilise une adresse sur ton propre domaine. Gmail rejette les envois en masse depuis @gmail.com.',
                'score_impact' => -5,
                'action_link' => 'config_dns',
            ];
        } else {
            $ok[] = ['criterion' => 'from_domain', 'message' => 'From : domaine custom (' . $fromDomain . ')'];
        }

        // Warning non-scoré: images sans alt text
        $imgWithoutAlt = preg_match_all('/<img(?![^>]*\balt\s*=)[^>]*>/i', $html);
        $warnings = [];
        if ($imgWithoutAlt > 0) {
            $warnings[] = [
                'criterion' => 'img_alt',
                'message' => $imgWithoutAlt . ' image(s) sans attribut alt',
                'fix' => 'Ajoute alt="" à chaque <img> — améliore le score spam et l\'accessibilité.',
            ];
        }

        $score = max(0, $totalScore);

        return [
            'score' => $score,
            'grade' => $this->getGrade($score),
            'issues' => $issues,
            'ok' => $ok,
            'warnings' => $warnings,
        ];
    }

    private function getGrade(int $score): array
    {
        return match(true) {
            $score >= 90 => ['label' => 'Excellent', 'color' => 'green-bright'],
            $score >= 75 => ['label' => 'Bon', 'color' => 'green'],
            $score >= 50 => ['label' => 'Peut mieux faire', 'color' => 'orange'],
            default      => ['label' => 'Ne pas envoyer', 'color' => 'red'],
        };
    }
}
