<?php

namespace ChadMailer\Scoring;

class SpamWordList
{
    public static function getPatterns(): array
    {
        return [
            // Financier / gains
            '/\bgratuit(e?s?)?\b/i',
            '/\bsans frais\b/i',
            '/\bargent facile\b/i',
            '/\bgagnez?\b/i',
            '/\bcash\b/i',
            '/\brevenu passif\b/i',
            '/\brichesse\b/i',
            '/\bget paid\b/i',
            '/\bmake money\b/i',
            '/\bearn \$\b/i',
            '/\bfree money\b/i',
            '/\binstant cash\b/i',
            '/\bcredit card\b/i',
            '/\bno credit check\b/i',
            '/\bloan\b/i',
            '/\bmortgage\b/i',
            '/\brefinanc/i',
            '/\bdebt\b/i',
            '/\binvestissement garanti\b/i',
            '/\bgaranteed income\b/i',
            // Urgence / pression
            '/\burgent(e?)\b/i',
            '/\bact now\b/i',
            '/\bagissez maintenant\b/i',
            '/\blimited time\b/i',
            '/\boffre limit[eé]e\b/i',
            '/\bexpires?\b/i',
            '/\bexpire bient[oô]t\b/i',
            '/\blast chance\b/i',
            '/\bderni[eè]re chance\b/i',
            '/\bfinal notice\b/i',
            '/\bdernier avis\b/i',
            '/\bdon\'t miss\b/i',
            '/\bne manquez pas\b/i',
            '/\btoday only\b/i',
            '/\baujourd\'hui seulement\b/i',
            // Promesses exagérées
            '/\bgaranti\b/i',
            '/\b100%? (gratuit|free|garanti)\b/i',
            '/\bno risk\b/i',
            '/\bsans risque\b/i',
            '/\bpromise\b/i',
            '/\bje vous promets\b/i',
            '/\bmiracl/i',
            '/\bincroyable\b/i',
            '/\bincredibl/i',
            '/\bamazing\b/i',
            '/\bphenomenal\b/i',
            '/\bexclusiv/i',
            '/\bsecret\b/i',
            // Santé / perte de poids
            '/\bperte de poids\b/i',
            '/\blose weight\b/i',
            '/\bmaigrir\b/i',
            '/\bbrûle-graisse\b/i',
            '/\bfat burner\b/i',
            '/\banti-aging\b/i',
            '/\banti.?âge\b/i',
            '/\bcure\b/i',
            '/\bremède\b/i',
            '/\bpill\b/i',
            '/\bsupplement\b/i',
            // Phishing / sécurité
            '/\bverif(y|ier)\b/i',
            '/\bv[eé]rifiez?\b/i',
            '/\bconfirm(er)?\b/i',
            '/\bsuspended\b/i',
            '/\bsuspendu\b/i',
            '/\bupdate (your|your account)\b/i',
            '/\bclick (here|below)\b/i',
            '/\bcliquez ici\b/i',
            '/\bpassword\b/i',
            '/\bmot de passe\b/i',
            '/\baccount (suspended|compromised)\b/i',
            '/\bcompte (suspendu|compromis)\b/i',
            // Auto-référentiel spam
            '/\bnot spam\b/i',
            '/\bceci n\'est pas du spam\b/i',
            '/\bunsubscribe\b/i',
            '/\bse d[eé]sabonner\b/i',
            '/\bremove me\b/i',
            '/\bopt.?out\b/i',
            // Casino / jeux
            '/\bcasino\b/i',
            '/\bpoker\b/i',
            '/\bjackpot\b/i',
            '/\bloterie\b/i',
            '/\blottery\b/i',
            '/\byou (have )?(won|win)\b/i',
            '/\bvous avez gagn[eé]\b/i',
            // Adulte
            '/\bxxx\b/i',
            '/\badult(e)?\b/i',
            '/\bporn/i',
            '/\bsex\b/i',
            '/\berotic/i',
            // Formatage spam
            '/\$\$\$/i',
            '/!!!+/i',
            '/\bFREE\b/',
            '/\bGRATUIT\b/',
            '/\bURGENT\b/',
        ];
    }

    public static function analyze(string $text): array
    {
        $found = [];
        foreach (self::getPatterns() as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $found[] = $matches[0];
            }
        }
        return [
            'count' => count($found),
            'found' => array_unique($found),
        ];
    }
}
