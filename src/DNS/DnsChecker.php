<?php

namespace ChadMailer\DNS;

class DnsChecker
{
    public function check(string $domain, string $dkimSelector = 'mail'): array
    {
        return [
            'spf'  => $this->checkSpf($domain),
            'dkim' => $this->checkDkim($domain, $dkimSelector),
            'dmarc' => $this->checkDmarc($domain),
        ];
    }

    private function checkSpf(string $domain): array
    {
        $records = @dns_get_record($domain, DNS_TXT);
        if ($records === false) {
            return ['status' => 'error', 'message' => 'Impossible de résoudre ' . $domain, 'value' => null];
        }
        foreach ($records as $record) {
            $txt = $record['txt'] ?? $record['entries'][0] ?? '';
            if (str_starts_with($txt, 'v=spf1')) {
                $hasBrevo = str_contains($txt, 'spf.brevo.com') || str_contains($txt, 'spf.sendinblue.com');
                return [
                    'status' => 'found',
                    'message' => $hasBrevo ? 'SPF présent et inclut Brevo ✓' : 'SPF présent mais Brevo non inclus',
                    'value' => $txt,
                    'has_brevo' => $hasBrevo,
                ];
            }
        }
        return ['status' => 'missing', 'message' => 'Enregistrement SPF non trouvé', 'value' => null];
    }

    private function checkDkim(string $domain, string $selector): array
    {
        $host = $selector . '._domainkey.' . $domain;
        $records = @dns_get_record($host, DNS_TXT);
        if ($records === false || empty($records)) {
            return ['status' => 'missing', 'message' => 'DKIM non trouvé sur ' . $host, 'value' => null];
        }
        foreach ($records as $record) {
            $txt = $record['txt'] ?? $record['entries'][0] ?? '';
            if (str_contains($txt, 'v=DKIM1')) {
                return ['status' => 'found', 'message' => 'DKIM présent ✓', 'value' => substr($txt, 0, 80) . '...'];
            }
        }
        return ['status' => 'missing', 'message' => 'DKIM non trouvé (format invalide)', 'value' => null];
    }

    private function checkDmarc(string $domain): array
    {
        $host = '_dmarc.' . $domain;
        $records = @dns_get_record($host, DNS_TXT);
        if ($records === false || empty($records)) {
            return ['status' => 'missing', 'message' => 'DMARC non trouvé', 'value' => null];
        }
        foreach ($records as $record) {
            $txt = $record['txt'] ?? $record['entries'][0] ?? '';
            if (str_starts_with($txt, 'v=DMARC1')) {
                $policy = 'none';
                if (preg_match('/p=(\w+)/', $txt, $m)) { $policy = $m[1]; }
                return [
                    'status' => 'found',
                    'message' => 'DMARC présent, politique : p=' . $policy . ' ✓',
                    'value' => $txt,
                    'policy' => $policy,
                ];
            }
        }
        return ['status' => 'missing', 'message' => 'DMARC non trouvé (format invalide)', 'value' => null];
    }
}
