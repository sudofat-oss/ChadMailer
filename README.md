# ChadMailer

ChadMailer is an email sender with a web interface to:

- configure your provider (SMTP, SES, SendGrid, Brevo, etc.)
- create templates
- launch campaigns from CSV lists
- run quick test sends

## Quick installation

### Linux

```bash
curl -fsSL https://raw.githubusercontent.com/sudofat-oss/ChadMailer/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
iwr -useb https://raw.githubusercontent.com/sudofat-oss/ChadMailer/main/install.ps1 | iex
```

The scripts automatically install PHP if needed, download the `.phar`, and prepare the `chadmailer` folder.

## Run the application

### Linux

```bash
./chadmailer/chadmailer
```

### Windows

```powershell
.\chadmailer\chadmailer.ps1
```

Then open:

- `http://localhost:8000/index.html`

## Useful commands

Run on a custom port:

```bash
./chadmailer/chadmailer 8080 0.0.0.0
```

Send a campaign via CLI:

```bash
./chadmailer/chadmailer send <campaignId>
```

## Install from source (optional)

```bash
composer install
php cli.php
```

## Repo

- [https://github.com/sudofat-oss/ChadMailer](https://github.com/sudofat-oss/ChadMailer)
