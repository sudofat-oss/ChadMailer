#!/usr/bin/env bash
set -euo pipefail

APP_NAME="ChadMailer"
MIN_PHP="8.1.0"
DEFAULT_RELEASE_URL="https://github.com/chadmailer/chadmailer/releases/latest/download/chadmailer.phar"
RELEASE_URL="${CHADMAILER_RELEASE_URL:-$DEFAULT_RELEASE_URL}"
INSTALL_DIR="${CHADMAILER_INSTALL_DIR:-$PWD/chadmailer}"
PHAR_FILE="$INSTALL_DIR/chadmailer.phar"
LAUNCHER_FILE="$INSTALL_DIR/chadmailer"

say() { printf '%s\n' "$*"; }
warn() { printf '⚠️  %s\n' "$*" >&2; }
die() { printf '❌ %s\n' "$*" >&2; exit 1; }

version_ge() {
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | tail -n1)" = "$1" ]
}

have_cmd() { command -v "$1" >/dev/null 2>&1; }

download_to() {
  local url="$1"
  local output="$2"
  if have_cmd curl; then
    curl -fsSL "$url" -o "$output"
  elif have_cmd wget; then
    wget -qO "$output" "$url"
  else
    die "Ni curl ni wget n'est disponible."
  fi
}

install_php_with_pm() {
  local install_cmd=""

  if have_cmd apt-get; then
    install_cmd="apt-get update && apt-get install -y php-cli"
  elif have_cmd dnf; then
    install_cmd="dnf install -y php-cli"
  elif have_cmd yum; then
    install_cmd="yum install -y php-cli"
  elif have_cmd pacman; then
    install_cmd="pacman -Sy --noconfirm php"
  elif have_cmd zypper; then
    install_cmd="zypper --non-interactive install php8 php8-cli || zypper --non-interactive install php-cli php"
  elif have_cmd apk; then
    install_cmd="apk add --no-cache php81 php81-phar php81-openssl || apk add --no-cache php php-phar php-openssl"
  else
    return 1
  fi

  if [ "$(id -u)" -ne 0 ]; then
    if have_cmd sudo; then
      # shellcheck disable=SC2029
      sudo sh -lc "$install_cmd"
    else
      die "Installation automatique requiert sudo/root."
    fi
  else
    sh -lc "$install_cmd"
  fi
}

ensure_php() {
  if have_cmd php; then
    local php_version
    php_version="$(php -r 'echo PHP_VERSION;' 2>/dev/null || true)"
    if [ -n "$php_version" ] && version_ge "$php_version" "$MIN_PHP"; then
      say "✅ PHP détecté: $php_version"
      return
    fi
    warn "Version PHP insuffisante (${php_version:-inconnue}), minimum requis: $MIN_PHP."
  else
    warn "PHP introuvable."
  fi

  say "Tentative d'installation automatique de PHP..."
  if ! install_php_with_pm; then
    die "Aucun gestionnaire de paquets supporté trouvé.
Installe PHP >= $MIN_PHP manuellement: https://www.php.net/manual/fr/install.php"
  fi

  if ! have_cmd php; then
    die "PHP n'est toujours pas disponible après installation."
  fi

  local php_version
  php_version="$(php -r 'echo PHP_VERSION;' 2>/dev/null || true)"
  if [ -z "$php_version" ] || ! version_ge "$php_version" "$MIN_PHP"; then
    die "PHP installé mais version insuffisante (${php_version:-inconnue}), minimum requis: $MIN_PHP"
  fi
  say "✅ PHP prêt: $php_version"
}

write_launcher() {
  cat >"$LAUNCHER_FILE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)"
exec php "$SCRIPT_DIR/chadmailer.phar" "$@"
EOF
  chmod +x "$LAUNCHER_FILE"
}

main() {
  say "==> Installation $APP_NAME"
  say "URL release: $RELEASE_URL"
  say "Dossier cible: $INSTALL_DIR"

  ensure_php

  mkdir -p "$INSTALL_DIR"
  say "==> Téléchargement du PHAR..."
  download_to "$RELEASE_URL" "$PHAR_FILE"

  if [ ! -s "$PHAR_FILE" ]; then
    die "Le téléchargement du PHAR a échoué (fichier vide)."
  fi

  chmod +x "$PHAR_FILE" || true
  mkdir -p "$INSTALL_DIR/templates" "$INSTALL_DIR/campaigns" "$INSTALL_DIR/uploads" "$INSTALL_DIR/storage"
  write_launcher

  say ""
  say "✅ Installation terminée."
  say "Lancer le serveur: \"$LAUNCHER_FILE\""
  say "Lancer sur un port custom: \"$LAUNCHER_FILE\" 8080 0.0.0.0"
  say "Envoyer une campagne: \"$LAUNCHER_FILE\" send <campaignId>"
}

main "$@"
