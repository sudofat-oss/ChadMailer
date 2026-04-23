param(
  [string]$InstallDir = "",
  [string]$ReleaseUrl = ""
)

$ErrorActionPreference = "Stop"

$AppName = "ChadMailer"
$MinPhpVersion = [Version]"8.1.0"
$DefaultReleaseUrl = "https://github.com/chadmailer/chadmailer/releases/latest/download/chadmailer.phar"

if ([string]::IsNullOrWhiteSpace($ReleaseUrl)) {
  $ReleaseUrl = if ($env:CHADMAILER_RELEASE_URL) { $env:CHADMAILER_RELEASE_URL } else { $DefaultReleaseUrl }
}

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
  $InstallDir = if ($env:CHADMAILER_INSTALL_DIR) { $env:CHADMAILER_INSTALL_DIR } else { Join-Path (Get-Location).Path "chadmailer" }
}

$PharPath = Join-Path $InstallDir "chadmailer.phar"
$CmdLauncherPath = Join-Path $InstallDir "chadmailer.cmd"
$PsLauncherPath = Join-Path $InstallDir "chadmailer.ps1"

function Write-Info([string]$Message) { Write-Host $Message -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host $Message -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host $Message -ForegroundColor Yellow }
function Fail([string]$Message) { throw $Message }

function Get-PhpVersion {
  $phpCmd = Get-Command php -ErrorAction SilentlyContinue
  if (-not $phpCmd) { return $null }
  try {
    $v = & php -r "echo PHP_VERSION;" 2>$null
    if (-not $v) { return $null }
    return [Version]$v.Trim()
  } catch {
    return $null
  }
}

function Install-PhpIfNeeded {
  $v = Get-PhpVersion
  if ($v -and $v -ge $MinPhpVersion) {
    Write-Ok "PHP détecté: $v"
    return
  }

  if ($v) {
    Write-Warn "Version PHP insuffisante: $v (minimum: $MinPhpVersion)"
  } else {
    Write-Warn "PHP introuvable."
  }

  if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Info "Tentative d'installation de PHP via winget..."
    & winget install --id PHP.PHP --accept-package-agreements --accept-source-agreements --silent | Out-Null
  } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Info "Tentative d'installation de PHP via Chocolatey..."
    & choco install php -y | Out-Null
  } else {
    Fail "Impossible d'installer PHP automatiquement (winget/choco non disponibles). Installez PHP >= $MinPhpVersion: https://windows.php.net/download/"
  }

  # Rafraîchit le PATH de la session avec la valeur machine + utilisateur.
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

  $v = Get-PhpVersion
  if (-not $v) {
    Fail "PHP n'est toujours pas détecté après installation. Ouvrez un nouveau terminal puis relancez le script."
  }
  if ($v -lt $MinPhpVersion) {
    Fail "PHP détecté mais trop ancien: $v (minimum: $MinPhpVersion)"
  }
  Write-Ok "PHP prêt: $v"
}

function Write-Launchers {
  $cmdContent = "@echo off`r`nphp `"%~dp0chadmailer.phar`" %*`r`n"
  Set-Content -Path $CmdLauncherPath -Value $cmdContent -Encoding ASCII

  $psContent = @'
param([Parameter(ValueFromRemainingArguments = $true)] [string[]]$Args)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& php (Join-Path $ScriptDir "chadmailer.phar") @Args
'@
  Set-Content -Path $PsLauncherPath -Value $psContent -Encoding UTF8
}

Write-Info "==> Installation $AppName"
Write-Info "URL release: $ReleaseUrl"
Write-Info "Dossier cible: $InstallDir"

Install-PhpIfNeeded

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Write-Info "==> Téléchargement du PHAR..."
Invoke-WebRequest -Uri $ReleaseUrl -OutFile $PharPath

if ((Get-Item $PharPath).Length -le 0) {
  Fail "Téléchargement du PHAR échoué (fichier vide)."
}

foreach ($dir in @("templates", "campaigns", "uploads", "storage")) {
  New-Item -ItemType Directory -Path (Join-Path $InstallDir $dir) -Force | Out-Null
}
Write-Launchers

Write-Host ""
Write-Ok "✅ Installation terminée."
Write-Host "Lancer le serveur (cmd): `"$CmdLauncherPath`"" -ForegroundColor Gray
Write-Host "Lancer le serveur (PowerShell): `"$PsLauncherPath`"" -ForegroundColor Gray
Write-Host "Exemple campagne: php `"$PharPath`" send <campaignId>" -ForegroundColor Gray
