<?php

declare(strict_types=1);

namespace ChadMailer\Mailer;

use Symfony\Component\HttpClient\HttpClient;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use ChadMailer\DNS\DnsChecker;

/**
 * Un appel agrégé après sauvegarde SMTP : quotas + état d’authentification (API fournisseur + DNS si utile).
 * Références : Brevo GET /v3/account, /v3/senders/domains · SESv2 GetAccount, GetEmailIdentity · SendGrid /v3/user/credits, /v3/whitelabel/domains.
 */
final class SmtpRemoteSnapshotBuilder
{
    private HttpClientInterface $http;

    public function __construct(?HttpClientInterface $httpClient = null)
    {
        $this->http = $httpClient ?? HttpClient::create([
            'timeout' => 22,
            'max_duration' => 55,
        ]);
    }

    /**
     * @param array<string, mixed> $config Config SMTP complète (clés présentes)
     *
     * @return array<string, mixed>|null
     */
    public function build(array $config): ?array
    {
        $provider = strtolower((string) ($config['provider'] ?? ''));

        return match ($provider) {
            'brevo' => $this->buildBrevo($config),
            'ses', 'amazonses' => $this->buildSes($config),
            'sendgrid' => $this->buildSendGrid($config),
            default => null,
        };
    }

    /**
     * @param array<string, mixed> $config
     *
     * @return array<string, mixed>
     */
    private function buildBrevo(array $config): array
    {
        $apiKey = trim((string) ($config['api_key'] ?? ''));
        $out = $this->emptySnapshot('brevo');
        if ($apiKey === '') {
            $out['errors'][] = 'Clé API manquante';

            return $out;
        }
        $headers = ['api-key' => $apiKey, 'accept' => 'application/json'];

        $account = $this->httpJson('GET', 'https://api.brevo.com/v3/account', $headers);
        if ($account['ok'] && \is_array($account['data'])) {
            $out['quotas']['lines'] = array_merge($out['quotas']['lines'], $this->parseBrevoAccountQuotas($account['data']));
        } else {
            $out['errors'][] = 'Compte : ' . ($account['error'] ?? 'erreur');
        }

        $domains = $this->httpJson('GET', 'https://api.brevo.com/v3/senders/domains', $headers);
        if ($domains['ok'] && \is_array($domains['data'])) {
            $out['dns_badges'] = $this->aggregateBrevoDomainDns($domains['data']);
        } else {
            if ($out['dns_badges']['dkim'] === 'unknown') {
                $out['dns_badges'] = $this->dnsBadgesUnknown('Domaines : ' . ($domains['error'] ?? 'non lisible'));
            }
            $out['errors'][] = 'Domaines : ' . ($domains['error'] ?? 'erreur');
        }

        return $out;
    }

    /**
     * @param array<string, mixed> $data Réponse /v3/account
     *
     * @return list<string>
     */
    private function parseBrevoAccountQuotas(array $data): array
    {
        $lines = [];
        $plan = $data['plan'] ?? [];
        if (\is_array($plan)) {
            foreach ($plan as $row) {
                if (!\is_array($row)) {
                    continue;
                }
                $type = strtolower((string) ($row['type'] ?? ''));
                $creditsType = strtolower((string) ($row['creditsType'] ?? ''));
                $credits = $row['credits'] ?? null;
                $creditsLabel = $this->formatNumber($credits);

                $isSms = str_contains($creditsType, 'sms')
                    || $type === 'sms'
                    || ($type === 'subscription' && str_contains($creditsType, 'sms'));

                if ($isSms) {
                    if ($credits !== null && (float) $credits > 0) {
                        $lines[] = 'SMS : solde ' . $creditsLabel . ' crédit(s)';
                    }

                    continue;
                }

                if ($type === 'sms') {
                    continue;
                }

                if (
                    str_contains($creditsType, 'send')
                    || str_contains($creditsType, 'email')
                    || str_contains($creditsType, 'mail')
                    || $creditsType === 'sendlimit'
                ) {
                    $lines[] = 'E-mails (quota plan) : ' . $creditsLabel
                        . ($creditsType !== '' ? ' — ' . $creditsType : '');
                }
            }
        }

        if ($lines === []) {
            foreach ($plan as $row) {
                if (!\is_array($row)) {
                    continue;
                }
                $type = (string) ($row['type'] ?? '');
                $ct = (string) ($row['creditsType'] ?? '');
                $cr = $row['credits'] ?? null;
                if ($type !== '' || $ct !== '' || $cr !== null) {
                    $lines[] = trim($type . ' / ' . $ct, ' /') . ' : ' . $this->formatNumber($cr);
                }
            }
        }

        if ($lines === []) {
            $lines[] = 'Plan Brevo : voir la console pour le détail des envois / jour';
        }

        return array_values(array_unique($lines));
    }

    /**
     * @param array<string, mixed> $domainsResponse corps { domains: [...] }
     *
     * @return array{spf: string, dkim: string, dmarc: string, hint: string}
     */
    private function aggregateBrevoDomainDns(array $domainsResponse): array
    {
        $domains = $domainsResponse['domains'] ?? [];
        if (!\is_array($domains) || $domains === []) {
            return $this->dnsBadgesUnknown('Aucun domaine enregistré chez Brevo');
        }

        $spfScores = [];
        $dkimScores = [];
        $dmarcScores = [];

        foreach ($domains as $d) {
            if (!\is_array($d)) {
                continue;
            }
            $records = $d['dns_records'] ?? $d['dnsRecords'] ?? [];
            if (($records === [] || $records === null) && !empty($d['authenticated'])) {
                $spfScores[] = 'ok';
                $dkimScores[] = 'ok';
                $dmarcScores[] = 'ok';

                continue;
            }
            $spfR = $this->brevoDnsRecordScore($d, ['brevo_code', 'spf', 'SPF']);
            $dkimR = $this->brevoDnsRecordScore($d, ['dkim', 'DKIM']);
            $dmarcR = $this->brevoDnsRecordScore($d, ['dmarc', 'DMARC']);

            if ($spfR === 'unknown' && isset($d['authenticated']) && $d['authenticated'] === true) {
                $spfR = 'ok';
            }
            if ($dkimR === 'unknown' && isset($d['dkim_verified']) && $d['dkim_verified'] === true) {
                $dkimR = 'ok';
            }
            if ($dmarcR === 'unknown' && isset($d['dmarc_verified']) && $d['dmarc_verified'] === true) {
                $dmarcR = 'ok';
            }
            if ($dkimR === 'unknown' && isset($d['dkimStatus']) && strtolower((string) $d['dkimStatus']) === 'valid') {
                $dkimR = 'ok';
            }

            $spfScores[] = $spfR;
            $dkimScores[] = $dkimR;
            $dmarcScores[] = $dmarcR;
        }

        return [
            'spf' => $this->mergeScores($spfScores),
            'dkim' => $this->mergeScores($dkimScores),
            'dmarc' => $this->mergeScores($dmarcScores),
            'hint' => \count($domains) . ' domaine(s) Brevo (API + champs domaine)',
        ];
    }

    /**
     * @param array<string, mixed> $domainRow
     * @param list<string>         $typeNeedles
     */
    private function brevoDnsRecordScore(array $domainRow, array $typeNeedles): string
    {
        $records = $domainRow['dns_records'] ?? $domainRow['dnsRecords'] ?? [];
        if (!\is_array($records)) {
            return 'unknown';
        }
        $best = 'unknown';
        foreach ($records as $rec) {
            if (!\is_array($rec)) {
                continue;
            }
            $t = strtolower((string) ($rec['type'] ?? $rec['record_type'] ?? ''));
            $match = false;
            foreach ($typeNeedles as $n) {
                if ($t === strtolower($n)) {
                    $match = true;
                    break;
                }
            }
            if (!$match) {
                continue;
            }
            $ok = $rec['status'] ?? $rec['valid'] ?? $rec['isSet'] ?? null;
            if ($ok === true) {
                return 'ok';
            }
            if ($ok === false) {
                $best = 'fail';
            } elseif ($best === 'unknown') {
                $best = 'warn';
            }
        }

        return $best;
    }

    /**
     * @param array<string, mixed> $config
     *
     * @return array<string, mixed>
     */
    private function buildSes(array $config): array
    {
        $out = $this->emptySnapshot('ses');
        $access = trim((string) ($config['access_key'] ?? ''));
        $secret = trim((string) ($config['secret_key'] ?? ''));
        $region = trim((string) ($config['region'] ?? '')) ?: 'eu-west-3';
        if ($access === '' || $secret === '') {
            $out['errors'][] = 'Clés IAM manquantes';

            return $out;
        }

        $inspector = new SesAccountInspector($this->http);
        $details = $inspector->fetchDetails($access, $secret, $region);
        $account = $details['account'] ?? null;
        if (\is_array($account)) {
            $out['quotas']['lines'] = $this->parseSesQuotas($account);
        } else {
            $out['errors'][] = $details['errors']['account'] ?? 'Compte SES illisible';
        }

        $identitiesPage = $details['identities'] ?? null;
        $domainNames = $this->sesVerifiedDomainNames($identitiesPage);
        $out['dns_badges'] = $this->aggregateSesIdentityDns($access, $secret, $region, $domainNames);

        return $out;
    }

    /**
     * @param array<string, mixed> $account GetAccount SESv2
     *
     * @return list<string>
     */
    private function parseSesQuotas(array $account): array
    {
        $lines = [];
        $sq = $account['SendQuota'] ?? [];
        if (\is_array($sq)) {
            $max24 = isset($sq['Max24HourSend']) ? (float) $sq['Max24HourSend'] : null;
            $sent = isset($sq['SentLast24Hours']) ? (float) $sq['SentLast24Hours'] : null;
            $rate = isset($sq['MaxSendRate']) ? (float) $sq['MaxSendRate'] : null;
            if ($max24 !== null) {
                if ($max24 < 0) {
                    $lines[] = 'Quota 24 h : illimité (valeur API -1)';
                } else {
                    $rest = $sent !== null ? max(0.0, $max24 - $sent) : null;
                    $lines[] = 'Quota 24 h : ' . $this->formatNumber($max24)
                        . ($sent !== null ? ' — envoyés (glissant) : ' . $this->formatNumber($sent) : '')
                        . ($rest !== null ? ' — reste ~' . $this->formatNumber($rest) : '');
                }
            }
            if ($rate !== null && $rate > 0) {
                $lines[] = 'Débit max : ' . $this->formatNumber($rate) . ' e-mails/s';
            }
        }

        $vdm = $account['VdmAttributes'] ?? [];
        if (\is_array($vdm) && isset($vdm['DashboardAttributes']['EngagementMetrics'])) {
            $lines[] = 'Métriques d’engagement (VDM) : '
                . ((bool) $vdm['DashboardAttributes']['EngagementMetrics'] ? 'activées' : 'désactivées');
        }

        $prod = (bool) ($account['ProductionAccessEnabled'] ?? false);
        $sendEn = (bool) ($account['SendingEnabled'] ?? false);
        $lines[] = 'Production : ' . ($prod ? 'oui' : 'non (sandbox possible)') . ' — envoi : ' . ($sendEn ? 'activé' : 'désactivé');

        if ($lines === []) {
            $lines[] = 'Quota SES : voir la console AWS pour le détail';
        }

        return $lines;
    }

    /**
     * @param array<string, mixed>|null $identitiesPage
     *
     * @return list<string>
     */
    private function sesVerifiedDomainNames(?array $identitiesPage): array
    {
        if (!\is_array($identitiesPage)) {
            return [];
        }
        $rows = $identitiesPage['EmailIdentities'] ?? [];
        if (!\is_array($rows)) {
            return [];
        }
        $domains = [];
        foreach ($rows as $row) {
            if (!\is_array($row)) {
                continue;
            }
            $status = strtoupper((string) ($row['VerificationStatus'] ?? ''));
            if ($status !== 'SUCCESS') {
                continue;
            }
            $name = trim((string) ($row['IdentityName'] ?? ''));
            $type = strtoupper((string) ($row['IdentityType'] ?? ''));
            if ($name === '' || str_contains($name, '@')) {
                continue;
            }
            if ($type === 'DOMAIN' || $type === 'MANAGED_DOMAIN') {
                $domains[] = $name;
            }
        }

        return array_values(array_unique($domains));
    }

    /**
     * @param list<string> $domainNames
     *
     * @return array{spf: string, dkim: string, dmarc: string, hint: string}
     */
    private function aggregateSesIdentityDns(string $access, string $secret, string $region, array $domainNames): array
    {
        if ($domainNames === []) {
            return $this->dnsBadgesUnknown('Aucun domaine vérifié (identités e-mail seules)');
        }

        $inspector = new SesAccountInspector($this->http);
        $dkimScores = [];
        $dnsChecker = new DnsChecker();
        $spfScores = [];
        $dmarcScores = [];

        $slice = \array_slice($domainNames, 0, 6);
        foreach ($slice as $domain) {
            try {
                /** @var array<string, mixed> $identity */
                $identity = $inspector->getEmailIdentity($access, $secret, $region, $domain);
                $dkim = $identity['DkimAttributes'] ?? [];
                $status = strtoupper((string) ($dkim['Status'] ?? ''));
                if ($status === 'SUCCESS') {
                    $dkimScores[] = 'ok';
                } elseif ($status === 'FAILED' || $status === 'TEMPORARY_FAILURE') {
                    $dkimScores[] = 'fail';
                } elseif ($status === 'PENDING' || $status === 'NOT_STARTED') {
                    $dkimScores[] = 'warn';
                } else {
                    $dkimScores[] = 'unknown';
                }
            } catch (\Throwable) {
                $dkimScores[] = 'unknown';
            }

            $spfScores[] = $this->sesPublicSpfScore($domain);
            $spf = $dnsChecker->check($domain, 'mail');
            $dm = $spf['dmarc'] ?? [];
            $dmarcScores[] = ($dm['status'] ?? '') === 'found' ? 'ok' : (($dm['status'] ?? '') === 'missing' ? 'warn' : 'warn');
        }

        $spfMerged = $spfScores !== [] ? $this->mergeScores($spfScores) : 'unknown';
        $dmarcMerged = $dmarcScores !== [] ? $this->mergeScores($dmarcScores) : 'unknown';

        return [
            'spf' => $spfMerged,
            'dkim' => $dkimScores !== [] ? $this->mergeScores($dkimScores) : 'unknown',
            'dmarc' => $dmarcMerged,
            'hint' => 'SES · ' . \count($slice) . ' domaine(s) — SPF/DMARC via DNS public',
        ];
    }

    /**
     * @param array<string, mixed> $config
     *
     * @return array<string, mixed>
     */
    private function buildSendGrid(array $config): array
    {
        $out = $this->emptySnapshot('sendgrid');
        $apiKey = trim((string) ($config['api_key'] ?? ''));
        if ($apiKey === '') {
            $out['errors'][] = 'Clé API manquante';

            return $out;
        }
        $regionHint = SendGridRestClient::normalizeRegionHint(trim((string) ($config['sendgrid_region'] ?? '')));
        $sg = new SendGridRestClient($this->http, $regionHint);
        $locked = null;

        $credits = $sg->get('/v3/user/credits', $apiKey, $locked);
        if ($credits['ok'] && \is_array($credits['data']) && !isset($credits['data']['_non_json'])) {
            $out['quotas']['lines'] = $this->parseSendGridCredits($credits['data']);
        } else {
            $out['errors'][] = 'Crédits : ' . ($credits['error'] ?? 'erreur');
        }

        $wl = $sg->get('/v3/whitelabel/domains?limit=50', $apiKey, $locked);
        if ($wl['ok'] && \is_array($wl['data']) && !isset($wl['data']['_non_json'])) {
            $out['dns_badges'] = $this->aggregateSendGridWhitelabel($wl['data']);
        } else {
            if ($out['dns_badges']['dkim'] === 'unknown') {
                $out['dns_badges'] = $this->dnsBadgesUnknown('Domain auth : ' . ($wl['error'] ?? 'non lisible'));
            }
            $out['errors'][] = 'Domaines : ' . ($wl['error'] ?? 'erreur');
        }
        if ($locked !== null && $locked !== '') {
            $out['api_base_used'] = $locked;
        }

        return $out;
    }

    /**
     * @param array<string, mixed> $data
     *
     * @return list<string>
     */
    private function parseSendGridCredits(array $data): array
    {
        $lines = [];
        $remain = $data['remain'] ?? null;
        $total = $data['total'] ?? null;
        $used = $data['used'] ?? null;
        $freq = $data['reset_frequency'] ?? $data['resetFrequency'] ?? null;
        $next = $data['next_reset'] ?? $data['nextReset'] ?? null;

        if ($remain !== null || $total !== null) {
            $lines[] = 'Crédits e-mail : '
                . ($remain !== null ? $this->formatNumber($remain) . ' restants' : '?')
                . ($total !== null ? ' / ' . $this->formatNumber($total) . ' au total' : '')
                . ($used !== null ? ' — utilisés : ' . $this->formatNumber($used) : '');
        }
        if ($freq !== null && $freq !== '') {
            $lines[] = 'Réinitialisation : ' . (string) $freq
                . ($next !== null && $next !== '' ? ' — prochaine : ' . (string) $next : '');
        }

        if ($lines === []) {
            $lines[] = 'Quota SendGrid : consulter la facturation / plan dans le dashboard';
        }

        return $lines;
    }

    /**
     * @param array<string, mixed> $wlResponse
     *
     * @return array{spf: string, dkim: string, dmarc: string, hint: string}
     */
    private function aggregateSendGridWhitelabel(array $wlResponse): array
    {
        $rows = $wlResponse;
        if (isset($wlResponse['domains']) && \is_array($wlResponse['domains'])) {
            $rows = $wlResponse['domains'];
        } elseif (!isset($wlResponse[0]) && isset($wlResponse['id'])) {
            $rows = [$wlResponse];
        }
        if (!\is_array($rows) || $rows === []) {
            return $this->dnsBadgesUnknown('Aucun domaine authentifié SendGrid');
        }

        $spf = [];
        $dkim = [];
        $dmarc = [];

        foreach ($rows as $row) {
            if (!\is_array($row)) {
                continue;
            }
            $valid = !empty($row['valid']);
            $dns = $row['dns'] ?? [];
            if (!\is_array($dns)) {
                $dns = [];
            }

            if ($valid && $dns === []) {
                $spf[] = 'ok';
                $dkim[] = 'ok';
                $dmarc[] = 'ok';

                continue;
            }

            $mailCname = $dns['mail_cname'] ?? $dns['mail_server'] ?? null;
            $spf[] = $this->sendGridDnsLeafOk($mailCname, $valid);

            $dkimOk = false;
            foreach (['dkim1', 'dkim2', 'dkim'] as $k) {
                if (!empty($dns[$k]) && $this->sendGridDnsLeafOk($dns[$k], $valid) === 'ok') {
                    $dkimOk = true;
                    break;
                }
            }
            $dkim[] = $dkimOk ? 'ok' : ($valid ? 'warn' : 'fail');

            $dm = $dns['dmarc'] ?? null;
            $dmarc[] = $this->sendGridDnsLeafOk($dm, $valid);
        }

        return [
            'spf' => $this->mergeScores($spf),
            'dkim' => $this->mergeScores($dkim),
            'dmarc' => $this->mergeScores($dmarc),
            'hint' => \count($rows) . ' domaine(s) SendGrid (whitelabel)',
        ];
    }

    /**
     * @param mixed $leaf
     */
    private function sendGridDnsLeafOk($leaf, bool $domainValid): string
    {
        if (!\is_array($leaf)) {
            return $domainValid ? 'warn' : 'unknown';
        }
        $v = $leaf['valid'] ?? false;

        return $v ? 'ok' : 'fail';
    }

    /**
     * @return array{ok: bool, data: ?array, error: ?string}
     */
    private function httpJson(string $method, string $url, array $headers): array
    {
        try {
            $r = $this->http->request($method, $url, ['headers' => $headers]);
            $status = $r->getStatusCode();
            $body = $r->getContent(false);
            if ($status >= 400) {
                $decoded = json_decode($body, true);
                $msg = 'HTTP ' . $status;
                if (\is_array($decoded)) {
                    $msg = (string) ($decoded['message'] ?? $decoded['errors'][0]['message'] ?? $msg);
                }

                return ['ok' => false, 'data' => null, 'error' => $msg];
            }
            $decoded = json_decode($body, true);

            return ['ok' => true, 'data' => \is_array($decoded) ? $decoded : null, 'error' => null];
        } catch (\Throwable $e) {
            return ['ok' => false, 'data' => null, 'error' => $e->getMessage()];
        }
    }

    private function emptySnapshot(string $provider): array
    {
        return [
            'provider' => $provider,
            'fetched_at' => (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->format(\DateTimeInterface::ATOM),
            'quotas' => ['lines' => []],
            'dns_badges' => [
                'spf' => 'unknown',
                'dkim' => 'unknown',
                'dmarc' => 'unknown',
                'hint' => '',
            ],
            'errors' => [],
        ];
    }

    /**
     * @return array{spf: string, dkim: string, dmarc: string, hint: string}
     */
    private function dnsBadgesUnknown(string $hint): array
    {
        return [
            'spf' => 'unknown',
            'dkim' => 'unknown',
            'dmarc' => 'unknown',
            'hint' => $hint,
        ];
    }

    /**
     * @param list<string> $scores ok|warn|fail|unknown
     */
    private function mergeScores(array $scores): string
    {
        if ($scores === []) {
            return 'unknown';
        }
        if (\in_array('fail', $scores, true)) {
            return 'fail';
        }
        if (\in_array('warn', $scores, true)) {
            return 'warn';
        }
        if (\in_array('unknown', $scores, true)) {
            return \in_array('ok', $scores, true) ? 'warn' : 'unknown';
        }

        return 'ok';
    }

    /** SPF public pour domaines SES (include amazonses.com / spf.amazonaws.com). */
    private function sesPublicSpfScore(string $domain): string
    {
        $records = @dns_get_record($domain, DNS_TXT);
        if ($records === false || $records === []) {
            return 'fail';
        }
        foreach ($records as $record) {
            $txt = $record['txt'] ?? $record['entries'][0] ?? '';
            if (!str_starts_with($txt, 'v=spf1')) {
                continue;
            }
            if (str_contains($txt, 'amazonses.com') || str_contains($txt, 'spf.amazonaws.com') || str_contains($txt, 'include:amazonses.com')) {
                return 'ok';
            }

            return 'warn';
        }

        return 'fail';
    }

    private function formatNumber(mixed $n): string
    {
        if ($n === null) {
            return '—';
        }
        if (!is_numeric($n)) {
            return (string) $n;
        }
        $f = (float) $n;
        if (abs($f - round($f)) < 0.0001) {
            return number_format((int) round($f), 0, ',', ' ');
        }

        return number_format($f, 0, ',', ' ');
    }
}
