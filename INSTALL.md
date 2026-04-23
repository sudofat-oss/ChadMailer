# Guide d'installation ChadMailer

## Installation rapide

### Option A — One-line installer (Linux / Windows)

Le plus simple pour un poste vierge : détecte/installe PHP automatiquement, télécharge le PHAR et prépare le dossier d'exécution.

Linux / macOS :

```bash
curl -fsSL https://raw.githubusercontent.com/chadmailer/chadmailer/main/install.sh | bash
```

Windows (PowerShell) :

```powershell
iwr -useb https://raw.githubusercontent.com/chadmailer/chadmailer/main/install.ps1 | iex
```

Variables optionnelles (dans les 2 scripts) :

- `CHADMAILER_INSTALL_DIR` : dossier de destination (défaut : `./chadmailer`)
- `CHADMAILER_RELEASE_URL` : URL directe du `chadmailer.phar`

### Option B — Installation depuis les sources (Composer)

### 1. Installer les dépendances

```bash
composer install
```

### 2. Configurer votre provider email

Éditez `config/config.php` et ajoutez vos credentials :

**Pour Mailgun :**
```php
'mailer' => [
    'provider' => 'mailgun',
    'credentials' => [
        'api_key' => 'votre-cle-api-mailgun',
        'domain' => 'votre-domaine.com',
    ],
    'from_email' => 'noreply@votre-domaine.com',
    'from_name' => 'Votre Nom',
],
```

**Pour SendGrid :**
```php
'mailer' => [
    'provider' => 'sendgrid',
    'credentials' => [
        'api_key' => 'votre-cle-api-sendgrid',
    ],
    'from_email' => 'noreply@votre-domaine.com',
    'from_name' => 'Votre Nom',
],
```

**Pour Amazon SES :**
```php
'mailer' => [
    'provider' => 'amazonses',
    'credentials' => [
        'access_key' => 'votre-access-key',
        'secret_key' => 'votre-secret-key',
        'region' => 'us-east-1', // ou eu-west-1, etc.
    ],
    'from_email' => 'noreply@votre-domaine.com',
    'from_name' => 'Votre Nom',
],
```

### 3. Lancer l'application

**Option A : Serveur PHP intégré (développement)**
```bash
php -S localhost:8000 -t public
```

Puis ouvrez : http://localhost:8000/index.html

**Option B : Apache/Nginx**

Configurez votre serveur web pour pointer vers le dossier `public/`.

### 4. Tester la configuration

1. Allez dans l'onglet "Configuration"
2. Remplissez vos informations
3. Sauvegardez

## Création d'un exécutable

### Méthode 1 : PHAR (Recommandé pour Linux/Mac)

```bash
# Créer le PHAR
php -d phar.readonly=0 build.php

# Rendre exécutable
chmod +x chadmailer.phar

# Lancer
./chadmailer.phar
```

### Méthode 2 : PHPacker (Multiplateforme)

```bash
# Installer PHPacker
composer require --dev phpacker/phpacker

# Créer le PHAR d'abord
php -d phar.readonly=0 build.php

# Convertir en exécutable
vendor/bin/phpacker build chadmailer.phar
```

### Méthode 3 : ExeOutput for PHP (Windows uniquement)

1. Téléchargez ExeOutput for PHP
2. Ouvrez le projet dans ExeOutput
3. Compilez en .EXE

## Première utilisation

1. **Créer un template** :
   - Allez dans "Templates"
   - Créez un template avec des variables comme `{{nom}}`, `{{prenom}}`
   - Voir `examples/template-example.json` pour un exemple

2. **Préparer un CSV** :
   - Créez un fichier CSV avec vos destinataires
   - La première ligne doit contenir les en-têtes (email, nom, prenom, etc.)
   - Voir `examples/example.csv` pour un exemple

3. **Créer une campagne** :
   - Allez dans "Campagnes"
   - Uploadez votre CSV
   - Sélectionnez vos templates
   - Configurez les délais
   - Créez la campagne

4. **Lancer la campagne** :
   - Cliquez sur "Lancer" sur la campagne créée
   - Suivez les statistiques en temps réel

## Dépannage

### Erreur "Class not found"
```bash
composer dump-autoload
```

### Erreur d'upload CSV
Vérifiez les permissions :
```bash
chmod 755 uploads/
```

### Erreur de configuration mailer
Vérifiez que vos credentials sont corrects dans `config/config.php`.

### Le PHAR ne fonctionne pas
Assurez-vous que `phar.readonly=0` dans votre php.ini ou utilisez :
```bash
php -d phar.readonly=0 chadmailer.phar
```

