<?php

declare(strict_types=1);

namespace ChadMailer\Mailer;

use Symfony\Component\HttpClient\HttpClient;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Agrège les informations lisibles via API pour Brevo, Amazon SES et SendGrid (sans appels automatiques côté UI).
 */
final class ProviderRemoteInspector
{
    private HttpClientInterface $http;

    public function __construct(?HttpClientInterface $httpClient = null)
    {
        $this->http = $httpClient ?? HttpClient::create([
            'timeout' => 25,
            'max_duration' => 45,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function inspectBrevo(string $apiKey): array
    {
        $apiKey = trim($apiKey);
        if ($apiKey === '') {
            throw new \InvalidArgumentException('Clé API Brevo requise.');
        }
        $out = [
            'provider' => 'brevo',
            'account' => null,
            'senders' => [],
            'partial_errors' => [],
        ];
        try {
            $r = $this->http->request('GET', 'https://api.brevo.com/v3/account', [
                'headers' => [
                    'accept' => 'application/json',
                    'api-key' => $apiKey,
                ],
            ]);
            $status = $r->getStatusCode();
            $body = $r->getContent(false);
            if ($status >= 400) {
                $out['partial_errors']['account'] = $this->brevoErrorMessage($body, $status);
            } else {
                $decoded = json_decode($body, true);
                $out['account'] = \is_array($decoded) ? $decoded : ['_raw' => $body];
            }
        } catch (\Throwable $e) {
            $out['partial_errors']['account'] = $e->getMessage();
        }
        try {
            $sendersClient = new BrevoSendersClient($this->http);
            $out['senders'] = $sendersClient->listVerifiedSenders($apiKey);
            $out['from_identities'] = $out['senders'];
        } catch (\Throwable $e) {
            $out['partial_errors']['senders'] = $e->getMessage();
            $out['from_identities'] = [];
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    public function inspectSes(string $accessKeyId, string $secretAccessKey, string $region): array
    {
        $inspector = new SesAccountInspector($this->http);
        $details = $inspector->fetchDetails($accessKeyId, $secretAccessKey, $region);
        $fromOptions = [];
        try {
            $fromOptions = $inspector->listVerifiedFromOptions($accessKeyId, $secretAccessKey, $region);
        } catch (\Throwable $e) {
            $details['errors']['from_options'] = $e->getMessage();
        }
        $sample = \array_slice($fromOptions, 0, 40);

        return [
            'provider' => 'ses',
            'region' => $details['region'] ?? $region,
            'account' => $details['account'],
            'identities_list' => $details['identities'],
            'verified_from_addresses' => $sample,
            'from_identities' => $fromOptions,
            'verified_from_total' => \count($fromOptions),
            'errors' => $details['errors'] ?? [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function inspectSendGrid(string $apiKey, ?string $sendgridRegion = null): array
    {
        $apiKey = SendGridRestClient::normalizeApiKey(trim($apiKey));
        if ($apiKey === '') {
            throw new \InvalidArgumentException('Clé API SendGrid requise.');
        }
        $regionHint = SendGridRestClient::normalizeRegionHint($sendgridRegion);
        $client = new SendGridRestClient($this->http, $regionHint);
        $lockedBase = null;
        $out = [
            'provider' => 'sendgrid',
            'user_profile' => null,
            'scopes' => null,
            'credits' => null,
            'partial_errors' => [],
        ];
        if (!str_starts_with($apiKey, 'SG.')) {
            $out['key_format_hint'] = 'Les clés API SendGrid v3 commencent en général par « SG. ». Vérifiez que vous collez bien une clé API (Settings → API Keys), pas un secret de webhook ou autre jeton.';
        }
        foreach ([
            'user_profile' => '/v3/user/profile',
            'scopes' => '/v3/scopes',
            'credits' => '/v3/user/credits',
        ] as $key => $path) {
            $res = $client->get($path, $apiKey, $lockedBase);
            if ($res['ok'] && \is_array($res['data'])) {
                $out[$key] = $res['data'];
            } else {
                $out['partial_errors'][$key] = $res['error'] ?? 'Erreur SendGrid';
            }
        }

        $vs = $client->get('/v3/verified_senders?limit=200', $apiKey, $lockedBase);
        if ($vs['ok'] && \is_array($vs['data'])) {
            $out['from_identities'] = SendGridRestClient::parseVerifiedSendersResponse($vs['data']);
        } else {
            $out['from_identities'] = [];
            $out['partial_errors']['verified_senders'] = $vs['error'] ?? 'Expéditeurs vérifiés : erreur SendGrid';
        }

        if ($lockedBase !== null && $lockedBase !== '') {
            $out['api_base_used'] = $lockedBase;
        }
        $this->appendSendGridPermissionHint($out);

        return $out;
    }

    /**
     * @param array<string, mixed> $out
     */
    private function appendSendGridPermissionHint(array &$out): void
    {
        $errs = $out['partial_errors'] ?? [];
        if (!\is_array($errs) || $errs === []) {
            return;
        }
        $authLike = 0;
        foreach ($errs as $msg) {
            if (!\is_string($msg)) {
                continue;
            }
            $m = strtolower($msg);
            if (str_contains($m, 'authorization') || str_contains($m, 'forbidden') || str_contains($m, 'access denied')) {
                ++$authLike;
            }
        }
        if ($authLike >= 2 || \count($errs) >= 3) {
            $out['permission_hint'] = 'Toutes les requêtes d’introspection ont échoué : (1) région API — pour un compte résident UE, choisissez « Union européenne » dans la config SendGrid et utilisez api.eu.sendgrid.com (voir option d’hôte dans l’app) ; (2) clé API restreinte — une clé avec seulement « Mail Send » peut envoyer des e-mails mais pas appeler GET /v3/user/profile, /v3/scopes ni /v3/user/credits. Créez une clé « Full Access » ou une clé personnalisée avec les scopes User (ex. user.profile.read, user.credits.read selon la doc). Référence : https://www.twilio.com/docs/sendgrid/ui/account-and-settings/api-keys et https://www.twilio.com/docs/sendgrid/api-reference/api-key-permissions';
        }
    }

    private function brevoErrorMessage(string $body, int $status): string
    {
        $decoded = json_decode($body, true);
        if (\is_array($decoded) && isset($decoded['message']) && \is_string($decoded['message'])) {
            return $decoded['message'];
        }

        return 'Brevo HTTP ' . $status;
    }

}
