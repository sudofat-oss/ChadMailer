<?php

declare(strict_types=1);

namespace ChadMailer\Mailer;

use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Requêtes GET vers l’API v3 SendGrid (auth Bearer, comme SendgridApiTransport Symfony).
 *
 * Les comptes « Data Residency EU » doivent utiliser api.eu.sendgrid.com. Par défaut on
 * essaie l’UE puis les US ; avec regionHint « global » uniquement api.sendgrid.com.
 *
 * @see https://www.twilio.com/docs/sendgrid/api-reference/how-to-use-the-sendgrid-v3-api
 */
final class SendGridRestClient
{
    private const EU_BASE = 'https://api.eu.sendgrid.com';

    private const US_BASE = 'https://api.sendgrid.com';

    public function __construct(
        private HttpClientInterface $http,
        private ?string $regionHint = null,
    ) {}

    public static function normalizeApiKey(string $raw): string
    {
        $k = $raw;
        if (str_starts_with($k, "\xEF\xBB\xBF")) {
            $k = substr($k, 3);
        }
        $k = trim($k);
        if (preg_match('/^bearer\s+/i', $k)) {
            $k = trim(substr($k, 7));
        }

        return $k;
    }

    /**
     * @return 'eu'|'global'|null null = essai UE puis US
     */
    public static function normalizeRegionHint(?string $raw): ?string
    {
        $r = strtolower(trim((string) $raw));
        if ($r === 'eu') {
            return 'eu';
        }
        if ($r === 'global' || $r === 'us') {
            return 'global';
        }

        return null;
    }

    /**
     * @return array{ok: bool, data: ?array, error: ?string, status: ?int, base_used: ?string}
     */
    public function get(string $pathAndQuery, string $apiKey, ?string &$lockedBase = null): array
    {
        $apiKey = self::normalizeApiKey($apiKey);
        $pathAndQuery = '/' . ltrim($pathAndQuery, '/');
        $bases = $this->resolveBases($lockedBase);

        $lastStatus = null;
        $lastError = 'SendGrid : échec de requête';

        foreach ($bases as $base) {
            $url = rtrim($base, '/') . $pathAndQuery;
            try {
                $r = $this->http->request('GET', $url, [
                    'auth_bearer' => $apiKey,
                    'headers' => [
                        'Accept' => 'application/json',
                        'User-Agent' => 'ChadMailer/1',
                    ],
                ]);
                $status = $r->getStatusCode();
                $body = $r->getContent(false);
                $lastStatus = $status;

                if ($status < 400) {
                    $lockedBase = $base;
                    $decoded = json_decode($body, true);
                    $data = \is_array($decoded) ? $decoded : ['_non_json' => mb_substr($body, 0, 800)];

                    return [
                        'ok' => true,
                        'data' => $data,
                        'error' => null,
                        'status' => $status,
                        'base_used' => $base,
                    ];
                }
                $lastError = $this->formatError($body, $status);
            } catch (\Throwable $e) {
                $lastError = $e->getMessage();
            }
        }

        return [
            'ok' => false,
            'data' => null,
            'error' => $lastError,
            'status' => $lastStatus,
            'base_used' => null,
        ];
    }

    /**
     * @return list<string>
     */
    private function resolveBases(?string &$lockedBase): array
    {
        if ($lockedBase !== null && $lockedBase !== '') {
            return [$lockedBase];
        }

        return match ($this->regionHint) {
            'eu' => [self::EU_BASE],
            'global' => [self::US_BASE],
            default => [self::EU_BASE, self::US_BASE],
        };
    }

    private function formatError(string $body, int $status): string
    {
        $decoded = json_decode($body, true);
        if (\is_array($decoded) && isset($decoded['errors']) && \is_array($decoded['errors'])) {
            $msgs = [];
            foreach ($decoded['errors'] as $err) {
                if (\is_array($err) && isset($err['message'])) {
                    $msgs[] = (string) $err['message'];
                }
            }
            if ($msgs !== []) {
                return implode(' ; ', $msgs) . ' (HTTP ' . $status . ')';
            }
        }
        if (\is_array($decoded) && isset($decoded['message'])) {
            return (string) $decoded['message'] . ' (HTTP ' . $status . ')';
        }
        if ($body !== '') {
            return 'HTTP ' . $status . ' : ' . mb_substr($body, 0, 200);
        }

        return 'SendGrid HTTP ' . $status;
    }

    /**
     * Parse la réponse de GET /v3/messages (Email Activity Feed API).
     *
     * NB : l'Email Activity Feed API est un add-on payant SendGrid (Email Activity
     * History). Sans add-on, l'API répond HTTP 401/403/404 selon les comptes.
     * Statuts possibles : "processed" (accepté par SendGrid), "delivered"
     * (accepté par le MX destinataire), "not_delivered" (bounce/drop/...).
     *
     * @param array<string, mixed>|null $data Corps JSON de GET /v3/messages
     *
     * @return list<array{msg_id: string, from_email: string, to_email: string, subject: string, status: string, opens_count: int, clicks_count: int, last_event_time: string}>
     */
    public static function parseMessagesResponse(?array $data): array
    {
        if (!\is_array($data)) {
            return [];
        }
        $rows = $data['messages'] ?? [];
        if (!\is_array($rows)) {
            return [];
        }

        $out = [];
        foreach ($rows as $row) {
            if (!\is_array($row)) {
                continue;
            }
            $out[] = [
                'msg_id' => (string) ($row['msg_id'] ?? ''),
                'from_email' => (string) ($row['from_email'] ?? ''),
                'to_email' => (string) ($row['to_email'] ?? ''),
                'subject' => (string) ($row['subject'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'opens_count' => (int) ($row['opens_count'] ?? 0),
                'clicks_count' => (int) ($row['clicks_count'] ?? 0),
                'last_event_time' => (string) ($row['last_event_time'] ?? ''),
            ];
        }

        return $out;
    }

    /**
     * @param array<string, mixed>|null $data Corps JSON de GET /v3/verified_senders
     *
     * @return list<array{email: string, label: string, name: string}>
     */
    public static function parseVerifiedSendersResponse(?array $data): array
    {
        if (!\is_array($data)) {
            return [];
        }
        $rows = $data['results'] ?? [];
        if (!\is_array($rows)) {
            return [];
        }
        $out = [];
        $seen = [];
        foreach ($rows as $row) {
            if (!\is_array($row)) {
                continue;
            }
            if (\array_key_exists('verified', $row) && $row['verified'] !== true) {
                continue;
            }
            $email = trim((string) ($row['from_email'] ?? ''));
            if ($email === '' || !str_contains($email, '@')) {
                continue;
            }
            $key = strtolower($email);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $name = trim((string) ($row['from_name'] ?? ''));
            if ($name === '') {
                $name = trim((string) ($row['nickname'] ?? ''));
            }
            $label = $name !== '' ? $name . ' <' . $email . '>' : $email;
            $out[] = ['email' => $email, 'label' => $label, 'name' => $name];
        }
        usort($out, static fn (array $a, array $b): int => strcasecmp($a['email'], $b['email']));

        return $out;
    }
}
