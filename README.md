# ChadMailer

ChadMailer est un sender email avec interface web pour :

- configurer ton provider (SMTP, SES, SendGrid, Brevo, etc.)
- créer des templates
- lancer des campagnes depuis des listes CSV
- faire des tests d'envoi rapidement

## Installation rapide

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/sudofat-oss/ChadMailer/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
iwr -useb https://raw.githubusercontent.com/sudofat-oss/ChadMailer/main/install.ps1 | iex
```

Les scripts installent PHP automatiquement si nécessaire, téléchargent le `.phar` et préparent le dossier `chadmailer`.

## Lancer l'application

### Linux

```bash
./chadmailer/chadmailer
```

### Windows

```powershell
.\chadmailer\chadmailer.ps1
```

Puis ouvre :

- `http://localhost:8000/index.html`

## Commandes utiles

Lancer sur un port personnalisé :

```bash
./chadmailer/chadmailer 8080 0.0.0.0
```

Envoyer une campagne via CLI :

```bash
./chadmailer/chadmailer send <campaignId>
```

## Installation depuis les sources (optionnel)

```bash
composer install
php cli.php
```

## Repo

- [https://github.com/sudofat-oss/ChadMailer](https://github.com/sudofat-oss/ChadMailer)
