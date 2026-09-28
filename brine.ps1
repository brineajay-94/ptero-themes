<#
.SYNOPSIS
    brine-theme manager - the single entry point on Windows.

.DESCRIPTION
    Opens an interactive menu with install / status / update / uninstall.
    Command line use:
        .\brine.ps1                  interactive menu
        .\brine.ps1 status [panel]   print status (0 = installed, 3 = not)
        .\brine.ps1 install [panel]  install
        .\brine.ps1 update [panel]   update an existing install
        .\brine.ps1 uninstall [panel]
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('menu', 'status', 'install', 'update', 'uninstall', 'help')]
    [string]$Command = 'menu',

    [Parameter(Position = 1)]
    [string]$PanelPath
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Installer = Join-Path $ScriptDir 'install.ps1'
$Manifest = Get-Content -LiteralPath (Join-Path $ScriptDir 'manifest.json') -Raw | ConvertFrom-Json
$ThemeName = 'brine-theme'
$ThemeVersion = $Manifest.version
$PowerShellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path -LiteralPath $PowerShellExe)) { $PowerShellExe = 'powershell' }

$script:IsInteractiveMenu = $false

function Test-PanelDir {
    param([string]$Path)
    if (-not $Path) { return $false }
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { return $false }
    return ((Test-Path -LiteralPath (Join-Path $Path 'artisan')) -and
            (Test-Path -LiteralPath (Join-Path $Path 'package.json')))
}

function Get-CandidatePanels {
    $list = @()
    if ($env:BRINE_PANEL) { $list += $env:BRINE_PANEL }
    $list += @(
        'C:\inetpub\pterodactyl'
        'C:\pterodactyl'
        'C:\www\pterodactyl'
        'C:\panel\pterodactyl'
        'D:\inetpub\pterodactyl'
        'D:\pterodactyl'
        (Get-Location).Path
    )
    return $list | Select-Object -Unique
}

function Resolve-Panel {
    param([string]$Explicit)

    if ($Explicit) {
        if (Test-PanelDir $Explicit) { return (Resolve-Path -LiteralPath $Explicit).Path }
        throw "'$Explicit' is not a Pterodactyl panel root (missing artisan/package.json)."
    }

    foreach ($candidate in (Get-CandidatePanels)) {
        if (Test-PanelDir $candidate) { return (Resolve-Path -LiteralPath $candidate).Path }
    }

    if ($script:IsInteractiveMenu -or -not [Console]::IsInputRedirected) {
        $answer = Read-Host 'Panel directory (the folder containing artisan)'
        if (Test-PanelDir $answer) { return (Resolve-Path -LiteralPath $answer).Path }
        throw "'$answer' is not a Pterodactyl panel root."
    }

    throw 'No Pterodactyl panel found. Pass the path: .\brine.ps1 <command> <panel-directory>'
}

function Invoke-Installer {
    param([string[]]$InstallerArgs)
    & $PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $Installer @InstallerArgs | Out-Host
    return $LASTEXITCODE
}

function Get-PanelStatus {
    param([string]$Panel)
    $output = @(& $PowerShellExe -NoProfile -ExecutionPolicy Bypass -File $Installer -PanelPath $Panel -Status 2>&1 | Out-String)
    $code = $LASTEXITCODE
    $map = @{ status = 'unknown'; installed_at = '' }
    foreach ($line in ($output -split "`r?`n")) {
        if ($line -like 'status=*') { $map.status = $line.Substring(7) }
        if ($line -like 'installed_at=*') { $map.installed_at = $line.Substring(13) }
    }
    if ($code -eq 0) { $map.status = 'installed' }
    return $map
}

function Get-StatusLabel {
    param([string]$Status)
    switch ($Status) {
        'installed' { 'INSTALLED' }
        'partial'   { 'PARTIAL (run update to repair)' }
        default     { 'NOT INSTALLED' }
    }
}

function Show-PanelHint {
    param([string]$Panel)
    Write-Host "  cd '$Panel'; yarn install --frozen-lockfile; yarn build:production"
    Write-Host "  php artisan view:clear; php artisan cache:clear; php artisan config:clear"
    Write-Host 'Then hard-refresh the browser (Ctrl+Shift+R).'
}

function Test-ShouldBuild {
    param([string]$Action)

    if ($env:BRINE_BUILD) { return ($env:BRINE_BUILD -eq 'y') }
    if (-not $script:IsInteractiveMenu) { return $false }

    $default = 'Y'
    $answer = Read-Host "Rebuild panel assets after $Action`? [Y/n]"
    if (-not $answer) { $answer = $default }
    return ($answer -match '^[Yy]')
}

function Show-Banner {
    param([string]$Panel)
    $state = Get-PanelStatus -Panel $Panel
    Write-Host '=============================================================='
    Write-Host ("  {0}  -  Pterodactyl Panel theme manager   v{1}" -f $ThemeName, $ThemeVersion)
    Write-Host '--------------------------------------------------------------'
    Write-Host "  Panel  : $Panel"
    $line = '  Status : ' + (Get-StatusLabel $state.status)
    if ($state.installed_at) { $line += '  (since ' + $state.installed_at + ')' }
    Write-Host $line
    Write-Host '=============================================================='
}

# ------------------------------------------------------------------ actions ---

function Invoke-Status {
    param([string]$Panel)
    $state = Get-PanelStatus -Panel $Panel
    Write-Host "theme=$ThemeName"
    Write-Host "version=$ThemeVersion"
    Write-Host "panel=$Panel"
    Write-Host "status=$($state.status)"
    if ($state.installed_at) { Write-Host "installed_at=$($state.installed_at)" }
    if ($state.status -eq 'installed') { return 0 }
    return 3
}

function Invoke-Install {
    param([string]$Panel)
    $state = Get-PanelStatus -Panel $Panel
    if ($state.status -ne 'not-installed') {
        Write-Host "$ThemeName is already installed in $Panel."
        Write-Host "Use 'update' to re-apply it, or 'uninstall' to restore the original panel."
        return 1
    }

    $installerArgs = @('-PanelPath', $Panel)
    if (Test-ShouldBuild 'installing') { $installerArgs += '-Build' }

    $code = Invoke-Installer $installerArgs
    if ($code -ne 0) { return $code }

    if ($installerArgs -notcontains '-Build') {
        Write-Host ''
        Write-Host 'Reminder - rebuild the panel manually:'
        Show-PanelHint $Panel
    }
    Write-Host ''
    Write-Host "$ThemeName installed."
    return 0
}

function Invoke-Update {
    param([string]$Panel)
    $state = Get-PanelStatus -Panel $Panel
    if ($state.status -eq 'not-installed') {
        Write-Host "$ThemeName is not installed in $Panel - run 'install' first."
        return 1
    }

    $installerArgs = @('-PanelPath', $Panel, '-Update')
    if (Test-ShouldBuild 'updating') { $installerArgs += '-Build' }

    $code = Invoke-Installer $installerArgs
    if ($code -ne 0) { return $code }

    if ($installerArgs -notcontains '-Build') {
        Write-Host ''
        Write-Host 'Reminder - rebuild the panel manually:'
        Show-PanelHint $Panel
    }
    Write-Host ''
    Write-Host "$ThemeName updated."
    return 0
}

function Invoke-UninstallAction {
    param([string]$Panel)
    $state = Get-PanelStatus -Panel $Panel
    if ($state.status -eq 'not-installed') {
        Write-Host "$ThemeName is not installed in $Panel - nothing to uninstall."
        return 0
    }

    $installerArgs = @('-PanelPath', $Panel, '-Uninstall')
    if (Test-ShouldBuild 'uninstalling') { $installerArgs += '-Build' }

    $code = Invoke-Installer $installerArgs
    if ($code -ne 0) { return $code }

    Write-Host ''
    Write-Host "$ThemeName uninstalled - the original panel theme is back."
    return 0
}

function Show-Menu {
    param([string]$Panel)

    while ($true) {
        Write-Host ''
        Show-Banner $Panel
        Write-Host ''
        Write-Host '  1) Install theme'
        Write-Host '  2) Status'
        Write-Host '  3) Update theme'
        Write-Host '  4) Uninstall (restore original panel)'
        Write-Host '  5) Change panel directory'
        Write-Host '  0) Exit'
        Write-Host ''
        $choice = Read-Host 'Choose [0-5]'

        switch ($choice) {
            '1' { Invoke-Install $Panel | Out-Null }
            '2' { Invoke-Status $Panel | Out-Null }
            '3' { Invoke-Update $Panel | Out-Null }
            '4' { Invoke-UninstallAction $Panel | Out-Null }
            '5' {
                $answer = Read-Host 'Panel directory'
                try {
                    $Panel = Resolve-Panel -Explicit $answer
                    Write-Host "Panel set to: $Panel"
                }
                catch {
                    Write-Host "Panel path rejected - keeping $Panel"
                }
            }
            { $_ -eq '0' -or $_ -eq '' } { Write-Host 'Bye.'; return }
            default { Write-Host "Unknown option: $choice" }
        }
    }
}

# --------------------------------------------------------------------- main ---

if ($Command -eq 'help') {
    Write-Host @"
brine-theme manager

  .\brine                     interactive menu (install / status / update / uninstall)
  .\brine status [panel]      print status (exit 0 installed, 3 not installed)
  .\brine install [panel]     install
  .\brine update [panel]      update an existing install
  .\brine uninstall [panel]   restore the original panel

Environment:
  BRINE_PANEL   default panel directory
  BRINE_BUILD   y/n - rebuild panel assets without asking (non-interactive)
"@
    exit 0
}

if ($Command -eq 'menu') { $script:IsInteractiveMenu = $true }

$Panel = Resolve-Panel -Explicit $PanelPath
$exitCode = 0

switch ($Command) {
    'menu'      { Show-Menu $Panel }
    'status'    { $exitCode = Invoke-Status $Panel }
    'install'   { $exitCode = Invoke-Install $Panel }
    'update'    { $exitCode = Invoke-Update $Panel }
    'uninstall' { $exitCode = Invoke-UninstallAction $Panel }
}

exit $exitCode
