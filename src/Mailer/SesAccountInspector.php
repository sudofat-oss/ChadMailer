<?php

declare(strict_types=1);

namespace ChadMailer\Mailer;

use AsyncAws\Core\Credentials\Credentials;
use AsyncAws\Core\Request;
use AsyncAws\Core\RequestContext;
use AsyncAws\Core\Signer\SignerV4;
use AsyncAws\Core\Stream\StreamFactory;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Appels lecture SES API v2 (GetAccount, liste d’identités) — nécessite Access Key + Secret (SigV4).
 */
final class SesAccountInspector
{
    /**
     * Régions SES API (email.{region}.amazonaws.com) — aligné sur la doc AWS
     * @see https://docs.aws.amazon.com/general/latest/gr/ses.html
     */
    private const PROBE_REGIONS = [
        'af-south-1',
        'ap-northeast-1',
        'ap-northeast-2',
        'ap-northeast-3',
        'ap-south-1',
        'ap-south-2',
        'ap-southeast-1',
        'ap-southeast-2',
        'ap-southeast-3',
        'ap-southeast-5',
        'ca-central-1',
        'ca-west-1',
        'eu-central-1',
        'eu-central-2',
        'eu-north-1',
        'eu-south-1',
        'eu-west-1',
        'eu-west-2',
        'eu-west-3',
        'il-central-1',
        'me-central-1',
        'me-south-1',
        'sa-east-1',
        'us-east-1',
        'us-east-2',
        'us-west-1',
        'us-west-2',
        'us-gov-east-1',
        'us-gov-west-1',
    ];

    /** @var array<string, string> */
    private const REGION_LABELS = [
        'af-south-1' => 'Afrique (Le Cap)',
        'ap-northeast-1' => 'Asie (Tokyo)',
        'ap-northeast-2' => 'Asie (Séoul)',
        'ap-northeast-3' => 'Asie (Osaka)',
        'ap-south-1' => 'Asie (Mumbai)',
        'ap-south-2' => 'Asie (Hyderabad)',
        'ap-southeast-1' => 'Asie (Singapour)',
        'ap-southeast-2' => 'Asie (Sydney)',
        'ap-southeast-3' => 'Asie (Jakarta)',
        'ap-southeast-5' => 'Asie (Malaisie)',
        'ca-central-1' => 'Canada (Centre)',
        'ca-west-1' => 'Canada Ouest (Calgary)',
        'eu-central-1' => 'Europe (Francfort)',
        'eu-central-2' => 'Europe (Zurich)',
        'eu-north-1' => 'Europe (Stockholm)',
        'eu-south-1' => 'Europe (Milan)',
        'eu-west-1' => 'Europe (Irlande)',
        'eu-west-2' => 'Europe (Londres)',
        'eu-west-3' => 'Europe (Paris)',
        'il-central-1' => 'Israël (Tel Aviv)',
        'me-central-1' => 'Moyen-Orient (Émirats)',
        'me-south-1' => 'Moyen-Orient (Bahreïn)',
        'sa-east-1' => 'Amérique du Sud (São Paulo)',
        'us-east-1' => 'USA (Virginie N.)',
        'us-east-2' => 'USA (Ohio)',
        'us-west-1' => 'USA (Californie N.)',
        'us-west-2' => 'USA (Oregon)',
        'us-gov-east-1' => 'AWS GovCloud (US-East)',
        'us-gov-west-1' => 'AWS GovCloud (US-West)',
    ];

    private HttpClientInterface $httpClient;

    public function __construct(?HttpClientInterface $httpClient = null)
    {
        $this->httpClient = $httpClient ?? HttpClient::create([
            'timeout' => 12,
            'max_duration' => 45,
        ]);
    }

    /**
     * @return array{region: string, account: ?array, identities: ?array, errors: array<string, string>}
     */
    public function fetchDetails(string $accessKeyId, string $secretAccessKey, string $region): array
    {
        $region = preg_match('/^[a-z0-9-]+$/', $region) ? $region : 'eu-west-3';
        $creds = new Credentials($accessKeyId, $secretAccessKey);

        $out = [
            'region' => $region,
            'account' => null,
            'identities' => null,
            'errors' => [],
        ];

        try {
            $out['account'] = $this->signedJsonGet($creds, $region, '/v2/email/account');
        } catch (\Throwable $e) {
            $out['errors']['account'] = $e->getMessage();
        }

        try {
            $out['identities'] = $this->signedJsonGet($creds, $region, '/v2/email/identities', ['PageSize' => '50']);
        } catch (\Throwable $e) {
            $out['errors']['identities'] = $e->getMessage();
        }

        return $out;
    }

    /**
     * Adresses utilisables comme From (identités email vérifiées + variantes courantes pour domaines vérifiés).
     *
     * @return list<array{email: string, label: string, name: string}>
     */
    public function listVerifiedFromOptions(string $accessKeyId, string $secretAccessKey, string $region): array
    {
        $region = preg_match('/^[a-z0-9-]+$/', $region) ? $region : 'eu-west-3';
        $creds = new Credentials($accessKeyId, $secretAccessKey);
        $seen = [];
        $options = [];
        $nextToken = null;
        $presets = ['noreply', 'newsletter', 'contact', 'hello', 'info', 'support', 'billing'];

        do {
            $query = ['PageSize' => '50'];
            if ($nextToken !== null && $nextToken !== '') {
                $query['NextToken'] = $nextToken;
            }
            $page = $this->signedJsonGet($creds, $region, '/v2/email/identities', $query);
            $rows = $page['EmailIdentities'] ?? [];
            if (!\is_array($rows)) {
                $rows = [];
            }
            foreach ($rows as $row) {
                if (!\is_array($row)) {
                    continue;
                }
                $status = strtoupper((string) ($row['VerificationStatus'] ?? ''));
                if ($status !== 'SUCCESS') {
                    continue;
                }
                if (\array_key_exists('SendingEnabled', $row) && $row['SendingEnabled'] === false) {
                    continue;
                }
                $name = trim((string) ($row['IdentityName'] ?? ''));
                if ($name === '') {
                    continue;
                }
                $type = strtoupper((string) ($row['IdentityType'] ?? ''));
                if ($type === 'EMAIL_ADDRESS' || str_contains($name, '@')) {
                    $key = strtolower($name);
                    if (!isset($seen[$key])) {
                        $seen[$key] = true;
                        $options[] = ['email' => $name, 'label' => $name, 'name' => ''];
                    }

                    continue;
                }
                if ($type === 'DOMAIN' || $type === 'MANAGED_DOMAIN') {
                    if (str_contains($name, '@')) {
                        continue;
                    }
                    $domain = $name;
                    foreach ($presets as $local) {
                        $email = $local . '@' . $domain;
                        $key = strtolower($email);
                        if (!isset($seen[$key])) {
                            $seen[$key] = true;
                            $options[] = [
                                'email' => $email,
                                'label' => $email . ' (domaine vérifié : ' . $domain . ')',
                                'name' => '',
                            ];
                        }
                    }
                }
            }
            $nextToken = $page['NextToken'] ?? null;
            if ($nextToken === '') {
                $nextToken = null;
            }
        } while ($nextToken !== null);

        usort($options, static fn (array $a, array $b): int => strcasecmp($a['email'], $b['email']));

        return $options;
    }

    /**
     * Interroge GetAccount en parallèle sur toutes les régions SES connues (même clé IAM).
     *
     * @return array{
     *   probe_all_regions: true,
     *   regions: list<array<string, mixed>>,
     *   summary: array<string, mixed>
     * }
     */
    public function probeAllRegions(string $accessKeyId, string $secretAccessKey, ?string $preferredRegion = null): array
    {
        $preferredRegion = $preferredRegion !== null && $preferredRegion !== '' && preg_match('/^[a-z0-9-]+$/', $preferredRegion)
            ? $preferredRegion
            : null;

        $creds = new Credentials($accessKeyId, $secretAccessKey);

        /** @var array<string, ResponseInterface|\Throwable> $pending */
        $pending = [];
        foreach (self::PROBE_REGIONS as $region) {
            try {
                $prepared = $this->prepareSignedGet($creds, $region, '/v2/email/account', []);
                $pending[$region] = $this->httpClient->request('GET', $prepared['url'], [
                    'headers' => $prepared['headers'],
                    'timeout' => 10,
                    'max_duration' => 14,
                ]);
            } catch (\Throwable $e) {
                $pending[$region] = $e;
            }
        }

        $rows = [];
        foreach ($pending as $region => $response) {
            if ($response instanceof \Throwable) {
                $rows[] = $this->makeProbeRow($region, false, null, $response->getMessage(), $preferredRegion);
                continue;
            }
            try {
                $status = $response->getStatusCode();
                $content = $response->getContent(false);
                if ($status >= 400) {
                    $rows[] = $this->makeProbeRow($region, false, null, $this->parseAwsErrorMessage($content, $status), $preferredRegion);
                    continue;
                }
                $decoded = json_decode($content, true);
                if (!\is_array($decoded)) {
                    $rows[] = $this->makeProbeRow($region, false, null, 'Réponse JSON invalide', $preferredRegion);
                    continue;
                }
                $rows[] = $this->makeProbeRow($region, true, $decoded, null, $preferredRegion);
            } catch (\Throwable $e) {
                $rows[] = $this->makeProbeRow($region, false, null, $e->getMessage(), $preferredRegion);
            }
        }

        $this->sortProbeRows($rows);

        return [
            'probe_all_regions' => true,
            'regions' => $rows,
            'summary' => $this->buildProbeSummary($rows, $preferredRegion),
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     * @return array<string, mixed>
     */
    private function buildProbeSummary(array $rows, ?string $preferredRegion): array
    {
        $okRows = array_values(array_filter($rows, static fn (array $r): bool => $r['ok'] === true));
        $reachable = \count($okRows);

        // $rows est déjà trié : premières lignes = OK avec le plus grand quota 24 h.
        $best = null;
        foreach ($rows as $r) {
            if (!empty($r['ok'])) {
                $best = $r;
                break;
            }
        }

        $preferredOk = false;
        $preferredError = null;
        if ($preferredRegion !== null) {
            foreach ($rows as $r) {
                if (($r['region'] ?? '') === $preferredRegion) {
                    $preferredOk = (bool) ($r['ok'] ?? false);
                    $preferredError = $r['error'] ?? null;
                    break;
                }
            }
        }

        return [
            'reachable_count' => $reachable,
            'best_quota_region' => $best['region'] ?? null,
            'best_quota_label' => $best['label'] ?? null,
            'best_max_24h' => $best['max_24h'] ?? null,
            'preferred_region' => $preferredRegion,
            'preferred_ok' => $preferredOk,
            'preferred_error' => $preferredError,
            'hint' => $reachable === 0
                ? 'Aucune région n’a répondu : vérifiez les droits IAM (ses:GetAccount) et la validité des clés.'
                : ($preferredRegion !== null && !$preferredOk
                    ? 'La région sélectionnée dans le formulaire ne répond pas ou refuse l’accès — choisissez une ligne « OK » ci-dessous.'
                    : null),
        ];
    }

    /**
     * @param list<array<string, mixed>> $rows
     */
    private function sortProbeRows(array &$rows): void
    {
        usort($rows, static function (array $a, array $b): int {
            $ao = !empty($a['ok']) ? 1 : 0;
            $bo = !empty($b['ok']) ? 1 : 0;
            if ($ao !== $bo) {
                return $bo <=> $ao;
            }
            if (empty($a['ok'])) {
                return strcmp((string) $a['region'], (string) $b['region']);
            }
            $ma = isset($a['max_24h']) ? (float) $a['max_24h'] : -1.0;
            $mb = isset($b['max_24h']) ? (float) $b['max_24h'] : -1.0;
            if ($ma !== $mb) {
                return $mb <=> $ma;
            }

            return strcmp((string) $a['region'], (string) $b['region']);
        });
    }

    /**
     * @param array<string, mixed>|null $account
     * @return array<string, mixed>
     */
    private function makeProbeRow(string $region, bool $ok, ?array $account, ?string $error, ?string $preferredRegion): array
    {
        $label = self::REGION_LABELS[$region] ?? $region;
        $row = [
            'region' => $region,
            'label' => $label,
            'ok' => $ok,
            'error' => $error,
            'matches_form_region' => $preferredRegion !== null && $region === $preferredRegion,
        ];

        if ($ok && $account !== null) {
            $sq = $account['SendQuota'] ?? [];
            $row['max_24h'] = isset($sq['Max24HourSend']) ? (float) $sq['Max24HourSend'] : null;
            $row['sent_24h'] = isset($sq['SentLast24Hours']) ? (float) $sq['SentLast24Hours'] : null;
            $row['max_rate'] = isset($sq['MaxSendRate']) ? (float) $sq['MaxSendRate'] : null;
            $row['production_access'] = (bool) ($account['ProductionAccessEnabled'] ?? false);
            $row['sending_enabled'] = (bool) ($account['SendingEnabled'] ?? false);
            $row['enforcement_status'] = $account['EnforcementStatus'] ?? null;
        }

        return $row;
    }

    /**
     * @param array<string, string> $query
     * @return array{url: string, headers: array<string, string>}
     */
    private function prepareSignedGet(Credentials $creds, string $region, string $path, array $query): array
    {
        $signer = new SignerV4('ses', $region);
        $qs = $query !== [] ? '?' . http_build_query($query) : '';
        $url = 'https://email.' . $region . '.amazonaws.com' . $path . $qs;

        $request = new Request('GET', '/', [], [
            'Accept' => 'application/json',
        ], StreamFactory::create(''));
        $request->setEndpoint($url);

        $signer->sign($request, $creds, new RequestContext());

        $headers = [];
        foreach ($request->getHeaders() as $k => $v) {
            $headers[$k] = $v;
        }

        return ['url' => $request->getEndpoint(), 'headers' => $headers];
    }

    /**
     * @param array<string, string> $query
     * @return array<mixed>
     */
    private function signedJsonGet(Credentials $creds, string $region, string $path, array $query = []): array
    {
        $prepared = $this->prepareSignedGet($creds, $region, $path, $query);

        $response = $this->httpClient->request('GET', $prepared['url'], [
            'headers' => $prepared['headers'],
        ]);

        $status = $response->getStatusCode();
        $content = $response->getContent(false);

        if ($status >= 400) {
            $msg = $this->parseAwsErrorMessage($content, $status);
            throw new \RuntimeException($msg);
        }

        $decoded = json_decode($content, true);
        if (!\is_array($decoded)) {
            throw new \RuntimeException('Réponse SES invalide (JSON attendu).');
        }

        return $decoded;
    }

    /**
     * Détail d’une identité (domaine ou adresse) — DKIM, Mail-From, etc.
     *
     * @see https://docs.aws.amazon.com/ses/latest/APIReference-V2/API_GetEmailIdentity.html
     *
     * @return array<string, mixed>
     */
    public function getEmailIdentity(string $accessKeyId, string $secretAccessKey, string $region, string $identity): array
    {
        $region = preg_match('/^[a-z0-9-]+$/', $region) ? $region : 'eu-west-3';
        $creds = new Credentials($accessKeyId, $secretAccessKey);
        $path = '/v2/email/identities/' . rawurlencode($identity);

        return $this->signedJsonGet($creds, $region, $path, []);
    }

    private function parseAwsErrorMessage(string $content, int $status): string
    {
        $decoded = json_decode($content, true);
        if (\is_array($decoded)) {
            $msg = $decoded['message'] ?? $decoded['Message'] ?? null;
            if (\is_string($msg) && $msg !== '') {
                return $msg;
            }
        }

        return $content !== '' ? "SES HTTP $status : " . mb_substr($content, 0, 500) : "SES HTTP $status";
    }
}
