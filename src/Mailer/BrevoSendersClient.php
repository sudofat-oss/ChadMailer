<?php

declare(strict_types=1);

namespace ChadMailer\Mailer;

use Symfony\Component\HttpClient\HttpClient;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Liste les expéditeurs Brevo (GET /v3/senders) — expéditeurs activés uniquement.
 */
final class BrevoSendersClient
{
    public function __construct(private ?HttpClientInterface $httpClient = null)
    {
    }

    /**
     * @return list<array{email: string, label: string, name: string}>
     */
    public function listVerifiedSenders(string $apiKey): array
    {
        $apiKey = trim($apiKey);
        if ($apiKey === '') {
            throw new \InvalidArgumentException('Clé API Brevo requise.');
        }
        $client = $this->httpClient ?? HttpClient::create(['timeout' => 20, 'max_duration' => 30]);
        $response = $client->request('GET', 'https://api.brevo.com/v3/senders', [
            'headers' => [
                'api-key' => $apiKey,
                'accept' => 'application/json',
            ],
        ]);
        $status = $response->getStatusCode();
        $body = $response->getContent(false);
        if ($status >= 400) {
            $decoded = json_decode($body, true);
            $msg = \is_array($decoded) && isset($decoded['message']) ? (string) $decoded['message'] : ('Brevo HTTP ' . $status);

            throw new \RuntimeException($msg);
        }
        $decoded = json_decode($body, true);
        if (!\is_array($decoded)) {
            throw new \RuntimeException('Réponse Brevo invalide.');
        }
        $senders = $decoded['senders'] ?? [];
        if (!\is_array($senders)) {
            return [];
        }
        $out = [];
        $seen = [];
        foreach ($senders as $row) {
            if (!\is_array($row)) {
                continue;
            }
            if (\array_key_exists('active', $row) && $row['active'] === false) {
                continue;
            }
            $email = trim((string) ($row['email'] ?? ''));
            if ($email === '' || !str_contains($email, '@')) {
                continue;
            }
            $key = strtolower($email);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $name = trim((string) ($row['name'] ?? ''));
            $label = $name !== '' ? $name . ' <' . $email . '>' : $email;
            $out[] = ['email' => $email, 'label' => $label, 'name' => $name];
        }
        usort($out, static fn (array $a, array $b): int => strcasecmp($a['email'], $b['email']));

        return $out;
    }
}
