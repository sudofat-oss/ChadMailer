param(
  [string]$InstallDir = "",
  [string]$ReleaseUrl = ""
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

$AppName = "ChadMailer"
$MinPhpVersion = [Version]"8.1.0"
$DefaultReleaseUrl = "https://github.com/sudofat-oss/ChadMailer/releases/latest/download/chadmailer.phar"

if ([string]::IsNullOrWhiteSpace($ReleaseUrl)) {
  $ReleaseUrl = if ($env:CHADMAILER_RELEASE_URL) { $env:CHADMAILER_RELEASE_URL } else { $DefaultReleaseUrl }
}

if ([string]::IsNullOrWhiteSpace($InstallDir)) {
  $InstallDir = if ($env:CHADMAILER_INSTALL_DIR) { $env:CHADMAILER_INSTALL_DIR } else { Join-Path (Get-Location).Path "chadmailer" }
}

$PharPath = Join-Path $InstallDir "chadmailer.phar"
$CmdLauncherPath = Join-Path $InstallDir "chadmailer.cmd"
$PsLauncherPath = Join-Path $InstallDir "chadmailer.ps1"
$WebLauncherPath = Join-Path $InstallDir "chadmailer-webapp.ps1"

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
    Fail "Impossible d'installer PHP automatiquement (winget/choco non disponibles). Installez PHP >= ${MinPhpVersion}: https://windows.php.net/download/"
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

  $webContent = @'
param(
  [int]$Port = 8000,
  [string]$ListenHost = "localhost"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerScript = Join-Path $ScriptDir "chadmailer.ps1"

# Open browser shortly after startup (in background), then keep this console alive with server logs.
Start-Process powershell -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-Command", "Start-Sleep -Seconds 2; Start-Process 'http://$ListenHost`:$Port/index.html'"
) | Out-Null

& $ServerScript $Port $ListenHost
'@
  Set-Content -Path $WebLauncherPath -Value $webContent -Encoding UTF8
}

function Write-DesktopShortcut {
  try {
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    if ([string]::IsNullOrWhiteSpace($desktopPath)) {
      Write-Warn "Impossible de détecter le Bureau, raccourci non créé."
      return
    }

    $shortcutPath = Join-Path $desktopPath "ChadMailer.lnk"
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = "powershell.exe"
    $shortcut.Arguments = "-NoExit -NoProfile -ExecutionPolicy Bypass -File `"$WebLauncherPath`""
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.Description = "Launch ChadMailer web app"
    $shortcut.IconLocation = "powershell.exe,0"
    $shortcut.Save()
    Write-Ok "Raccourci Bureau créé: $shortcutPath"
  } catch {
    Write-Warn "Création du raccourci Bureau échouée: $($_.Exception.Message)"
  }
}

Write-Info "==> Installation $AppName"
Write-Info "URL release: $ReleaseUrl"
Write-Info "Dossier cible: $InstallDir"

Install-PhpIfNeeded

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Write-Info "==> Téléchargement du PHAR..."
$downloaded = $false
for ($attempt = 1; $attempt -le 3; $attempt++) {
  try {
    Invoke-WebRequest -Uri $ReleaseUrl -OutFile $PharPath
    $downloaded = $true
    break
  } catch {
    if ($attempt -ge 3) { throw }
    Write-Warn "Téléchargement échoué (tentative $attempt/3), nouvelle tentative..."
    Start-Sleep -Seconds (2 * $attempt)
  }
}
if (-not $downloaded) {
  Fail "Téléchargement du PHAR échoué après 3 tentatives."
}

if ((Get-Item $PharPath).Length -le 0) {
  Fail "Téléchargement du PHAR échoué (fichier vide)."
}

foreach ($dir in @("templates", "campaigns", "uploads", "storage")) {
  New-Item -ItemType Directory -Path (Join-Path $InstallDir $dir) -Force | Out-Null
}
Write-Launchers
Write-DesktopShortcut

Write-Host ""
Write-Ok "✅ Installation terminée."
Write-Host "Lancer le serveur (cmd): `"$CmdLauncherPath`"" -ForegroundColor Gray
Write-Host "Lancer le serveur (PowerShell): `"$PsLauncherPath`"" -ForegroundColor Gray
Write-Host "Lancer + ouvrir la webapp: `"$WebLauncherPath`"" -ForegroundColor Gray
Write-Host "Exemple campagne: php `"$PharPath`" send <campaignId>" -ForegroundColor Gray
