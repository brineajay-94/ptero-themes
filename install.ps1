<#
.SYNOPSIS
    brine-theme installer for Pterodactyl Panel.

.EXAMPLE
    .\install.ps1 -PanelPath C:\inetpub\pterodactyl
.EXAMPLE
    .\install.ps1 -PanelPath C:\inetpub\pterodactyl -Build
.EXAMPLE
    .\install.ps1 -PanelPath C:\inetpub\pterodactyl -Update
.EXAMPLE
    .\install.ps1 -PanelPath C:\inetpub\pterodactyl -Uninstall
.EXAMPLE
    .\install.ps1 -PanelPath C:\inetpub\pterodactyl -Status
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$PanelPath,

    [Alias('b')]
    [switch]$Build,

    [Alias('u')]
    [switch]$Uninstall,

    [switch]$Update,

    [switch]$Status,

    [Alias('h')]
    [switch]$Help
)

$ErrorActionPreference = 'Stop'

$ThemeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Src = Join-Path $ThemeDir 'theme'
$ManifestPath = Join-Path $ThemeDir 'manifest.json'
$ThemeName = 'brine-theme'

function Show-Usage {
    Write-Host @"
brine-theme installer

Usage: .\install.ps1 -PanelPath <panel-directory> [-Build] [-Update] [-Uninstall] [-Status]

  -PanelPath   Root of the Pterodactyl panel install (the folder with artisan).
  -Build       Run yarn install / build:production and clear Laravel caches.
  -Update      Re-apply the theme over an existing install (keeps the original
               backup so -Uninstall still restores a clean panel).
  -Uninstall   Restore the most recent backup and remove created files.
  -Status      Print the install status (0 = installed, 3 = not installed).
  -Help        Show this help.

Backups are written to <panel-directory>\.pterodactyl-backup\<timestamp>\
Install state is written to <panel-directory>\.brine-theme.state
"@
}

if ($Help -or (-not $PanelPath -and -not $Help)) {
    Show-Usage
    exit $(if ($Help) { 0 } else { 1 })
}

if (-not (Test-Path -LiteralPath $PanelPath)) {
    throw "Panel directory not found: $PanelPath"
}

$PanelPath = (Resolve-Path -LiteralPath $PanelPath).Path

if (-not ((Test-Path -LiteralPath (Join-Path $PanelPath 'artisan')) -and
          (Test-Path -LiteralPath (Join-Path $PanelPath 'package.json')))) {
    throw "'$PanelPath' does not look like a Pterodactyl panel root (missing artisan/package.json)."
}

if (-not (Test-Path -LiteralPath $ManifestPath)) {
    throw "manifest.json not found next to this script."
}

$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$Files = @($Manifest.files)
$ThemeVersion = $Manifest.version

$BackupRoot = Join-Path $PanelPath '.pterodactyl-backup'
$StateFile = Join-Path $PanelPath '.brine-theme.state'
$ThemeMarker = Join-Path $PanelPath 'public\themes\pterodactyl\css\pterodactyl-theme.css'

function Get-LatestBackup {
    if (-not (Test-Path -LiteralPath $BackupRoot)) { return $null }
    $latest = Get-ChildItem -LiteralPath $BackupRoot -Directory | Sort-Object Name | Select-Object -Last 1
    if ($null -eq $latest) { return $null }
    return $latest.FullName
}

function Get-ThemePresent {
    return (Test-Path -LiteralPath $ThemeMarker)
}

function Get-StatusValue {
    $marker = Get-ThemePresent
    $state = Test-Path -LiteralPath $StateFile
    if ($marker -and $state) { return 'installed' }
    if ($marker -or $state) { return 'partial' }
    return 'not-installed'
}

function Write-State {
    param([string]$Mode, [string]$Backup = '')
    $lines = @(
        "name=$ThemeName"
        "version=$ThemeVersion"
        "installed_at=$((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))"
        "mode=$Mode"
        "backup=$Backup"
    )
    Set-Content -LiteralPath $StateFile -Value $lines -Encoding ASCII
}

function Show-Status {
    $value = Get-StatusValue
    Write-Host "theme=$ThemeName"
    Write-Host "panel=$PanelPath"

    switch ($value) {
        'installed' {
            $version = $ThemeVersion
            $since = 'unknown'
            foreach ($line in (Get-Content -LiteralPath $StateFile -ErrorAction SilentlyContinue)) {
                if ($line -like 'version=*') { $version = $line.Substring(8) }
                if ($line -like 'installed_at=*') { $since = $line.Substring(13) }
            }
            Write-Host 'status=installed'
            Write-Host "version=$version"
            Write-Host "installed_at=$since"
            exit 0
        }
        'partial' {
            Write-Host 'status=partial'
            Write-Host 'detail=theme files and state file disagree; run -Update (or -Uninstall) to fix'
            exit 3
        }
        default {
            Write-Host 'status=not-installed'
            exit 3
        }
    }
}

function Invoke-Uninstall {
    $value = Get-StatusValue
    $latest = Get-LatestBackup
    if (($value -eq 'not-installed') -and ($null -eq $latest)) {
        Write-Host "brine-theme is not installed in $PanelPath - nothing to restore."
        exit 0
    }
    if ($null -eq $latest) {
        throw "No backup found in $BackupRoot"
    }

    Write-Host "Restoring from: $latest"

    Get-ChildItem -LiteralPath $latest -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($latest.Length).TrimStart('\', '/')
        if ($relative -eq 'created.txt') { return }
        $target = Join-Path $PanelPath $relative
        $targetDir = Split-Path -Parent $target
        if (-not (Test-Path -LiteralPath $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        Copy-Item -LiteralPath $_.FullName -Destination $target -Force
        Write-Host ("restored {0}" -f $relative)
    }

    $createdList = Join-Path $latest 'created.txt'
    if (Test-Path -LiteralPath $createdList) {
        Get-Content -LiteralPath $createdList | ForEach-Object {
            $relative = $_.Trim()
            if (-not $relative) { return }
            $target = Join-Path $PanelPath $relative
            if (Test-Path -LiteralPath $target) {
                Remove-Item -LiteralPath $target -Force
                Write-Host ("removed  {0}" -f $relative)
            }
        }
    }

    # The restore above copies the manifest itself into the panel root.
    $strayList = Join-Path $PanelPath 'created.txt'
    if (Test-Path -LiteralPath $strayList) {
        Remove-Item -LiteralPath $strayList -Force
    }

    foreach ($file in $Files) {
        if ($file.action -ne 'create') { continue }
        $target = Join-Path $PanelPath $file.path
        if (Test-Path -LiteralPath $target) {
            Remove-Item -LiteralPath $target -Force
            Write-Host ("removed  {0}" -f $file.path)
        }
    }

    if (Test-Path -LiteralPath $StateFile) {
        Remove-Item -LiteralPath $StateFile -Force
    }

    Write-Host ''
    Write-Host 'brine-theme uninstalled - the panel is back to its original theme. Rebuild the assets:'
    Write-Host "  cd '$PanelPath'; yarn install --frozen-lockfile; yarn build:production"
    Write-Host "  php artisan view:clear; php artisan cache:clear"
}

if ($Status) {
    Show-Status
}

if ($Uninstall) {
    Invoke-Uninstall
    exit 0
}

$mode = 'install'
$Backup = $null

if ($Update) {
    if (-not (Get-ThemePresent)) {
        throw "brine-theme is not installed in $PanelPath (run without -Update first)."
    }
    $mode = 'update'
    $Backup = Get-LatestBackup
    Write-Host "Updating brine-theme in: $PanelPath"
    if ($null -ne $Backup) {
        Write-Host "Keeping the original backup (uninstall still restores it): $Backup"
    }
    else {
        Write-Warning "No original backup found - uninstall will not be able to restore this panel."
    }
}
else {
    if (Get-ThemePresent) {
        throw "brine-theme already appears to be installed in $PanelPath. Use -Update to re-apply, or .\install.ps1 -PanelPath '$PanelPath' -Uninstall."
    }

    $Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $Backup = Join-Path $BackupRoot $Stamp
    New-Item -ItemType Directory -Path $Backup -Force | Out-Null

    Write-Host "Installing brine-theme into: $PanelPath"
    Write-Host "Backing up original files to: $Backup"
}
Write-Host ''

# Paths with no panel original behind them, so uninstall knows what to delete.
$CreatedList = if ($null -ne $Backup) { Join-Path $Backup 'created.txt' } else { $null }

foreach ($file in $Files) {
    $source = Join-Path $Src ($file.path -replace '/', '\')
    $target = Join-Path $PanelPath ($file.path -replace '/', '\')
    $targetDir = Split-Path -Parent $target

    # A file the theme used to ship and no longer does. It has no payload, so this
    # branch has to come BEFORE the payload check below - otherwise a manifest
    # entry with no file behind it throws and reads as a broken install rather
    # than as the instruction it is.
    #
    # Backing up before deleting is what makes uninstall able to put it back: the
    # restore copies the whole backup tree over the panel root. But only an
    # install has a backup directory - `-Update` deliberately keeps the ORIGINAL
    # backup instead of making a new one, so $Backup is null there and writing
    # into it would throw. So the backup is guarded on both.
    #
    # On an update the file is simply deleted. That is safe: it was a file this
    # theme created, so the panel has no original of its own to lose, and it is
    # being removed because nothing references it any more.
    if ($file.action -eq 'remove') {
        if (-not (Test-Path -LiteralPath $target)) {
            Write-Host ('{0,-8} {1}  (not on the panel, nothing to do)' -f $file.action, $file.path)
        }
        elseif ($mode -eq 'status') {
            Write-Host ('{0,-8} {1}  (still on the panel - re-run without -Status to remove it)' -f $file.action, $file.path)
        }
        else {
            $backed = $false
            if (($mode -eq 'install') -and ($null -ne $Backup)) {
                $backupTargetDir = Split-Path -Parent (Join-Path $Backup ($file.path -replace '/', '\'))
                if (-not (Test-Path -LiteralPath $backupTargetDir)) {
                    New-Item -ItemType Directory -Path $backupTargetDir -Force | Out-Null
                }
                Copy-Item -LiteralPath $target -Destination (Join-Path $Backup ($file.path -replace '/', '\')) -Force
                $backed = $true
            }
            Remove-Item -LiteralPath $target -Force
            if ($backed) {
                Write-Host ('{0,-8} {1}  (removed; backup kept so uninstall can restore it)' -f $file.action, $file.path)
            }
            else {
                Write-Host ('{0,-8} {1}  (removed)' -f $file.action, $file.path)
            }
        }
        continue
    }

    if (-not (Test-Path -LiteralPath $source)) {
        throw "theme payload missing: $source"
    }

    if ($mode -eq 'install') {
        if (Test-Path -LiteralPath $target) {
            $backupTargetDir = Split-Path -Parent (Join-Path $Backup ($file.path -replace '/', '\'))
            if (-not (Test-Path -LiteralPath $backupTargetDir)) {
                New-Item -ItemType Directory -Path $backupTargetDir -Force | Out-Null
            }
            Copy-Item -LiteralPath $target -Destination (Join-Path $Backup ($file.path -replace '/', '\')) -Force
        }
        elseif ($file.action -ne 'create') {
            Write-Warning "Expected an existing file at $($file.path) but none was found; it will be created."
            Add-Content -LiteralPath $CreatedList -Value $file.path
        }
    }

    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    Copy-Item -LiteralPath $source -Destination $target -Force

    # Stamp the copy with the install time.
    #
    # The panel's stylesheet is cache-busted on its OWN mtime - the wrapper reads
    # @filemtime() and appends it as ?v=, because config('app.version') is the
    # panel's version and never changes on a theme update. Copy-Item carries the
    # SOURCE's timestamp across, and git does not rewrite a file it did not
    # change, so re-installing after pulling a commit that touched some OTHER
    # theme file re-copies the stylesheet with its OLD mtime. The URL comes out
    # identical, the browser serves its cached copy, and the update looks like it
    # did nothing - which is the one failure mode the mtime cache-buster exists
    # to prevent. Touching the file makes the URL change whenever the bytes do.
    (Get-Item -LiteralPath $target).LastWriteTime = Get-Date

    Write-Host ('{0,-8} {1}' -f $file.action, $file.path)
}

# The stock favicons are no longer referenced anywhere (the admin-uploaded logo
# is the favicon now), so take them out of the panel. They land inside the
# backup, which the uninstall restore copies straight back.
if ($mode -eq 'install') {
    $stockFavicons = Join-Path $PanelPath 'public\favicons'
    if (Test-Path -LiteralPath $stockFavicons) {
        $backupFavicons = Join-Path $Backup 'public\favicons'
        if (-not (Test-Path -LiteralPath (Split-Path -Parent $backupFavicons))) {
            New-Item -ItemType Directory -Path (Split-Path -Parent $backupFavicons) -Force | Out-Null
        }
        Move-Item -LiteralPath $stockFavicons -Destination $backupFavicons -Force
        Write-Host 'removed  public/favicons (kept in the backup for uninstall)'
    }
}

Write-State -Mode $mode -Backup $(if ($null -ne $Backup) { $Backup } else { '' })

Write-Host ''

function Find-Tool {
    param([string[]]$Names)
    foreach ($n in $Names) {
        $cmd = Get-Command $n -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($cmd) { return $cmd.Source }
    }
    return $null
}

function Invoke-AssetBuild {
    # yarn -> corepack -> npm. package.json's build:production shells out to
    # `yarn run clean`, so with npm alone the clean + webpack steps are run directly.
    #
    # Node 17+ ships OpenSSL 3, which refuses the md4 hashing webpack's css-loader
    # does (error:0308010C digital envelope routines::unsupported) - opt builds back
    # into the legacy provider there; older node rejects the flag, so it is only
    # added when the major version warrants it - and never twice.
    if (-not ($env:NODE_OPTIONS -like '*--openssl-legacy-provider*')) {
        $node = Find-Tool @('node', 'node.exe')
        $major = 0
        if ($node) {
            # `node -v` is the portable probe: PowerShell 5.1 strips the double
            # quotes out of a `node -p "..."` argument, which would leave a
            # syntax error on stderr and silently read as "version unknown".
            $version = (& $node -v 2>$null | Select-Object -First 1)
            if ("$version" -match '^v(\d+)\.') { $major = [int]$Matches[1] }
        }
        if ($major -ge 17) {
            $env:NODE_OPTIONS = (@($env:NODE_OPTIONS, '--openssl-legacy-provider') | Where-Object { $_ }) -join ' '
            Write-Host "==> node $major detected - adding --openssl-legacy-provider to NODE_OPTIONS"
        }
    }
    Push-Location $PanelPath
    try {
        $yarn = Find-Tool @('yarn', 'yarn.cmd', 'yarn.ps1')
        if ($yarn) {
            Write-Host "==> $yarn install --frozen-lockfile && $yarn build:production"
            & $yarn install --frozen-lockfile | Out-Host
            if ($LASTEXITCODE -ne 0) { return $LASTEXITCODE }
            & $yarn build:production | Out-Host
            return $LASTEXITCODE
        }

        $corepack = Find-Tool @('corepack', 'corepack.cmd')
        if ($corepack) {
            Write-Host '==> yarn is not on PATH - using corepack'
            & $corepack yarn install --frozen-lockfile | Out-Host
            if ($LASTEXITCODE -ne 0) { return $LASTEXITCODE }
            & $corepack yarn build:production | Out-Host
            return $LASTEXITCODE
        }

        $npm = Find-Tool @('npm', 'npm.cmd')
        $npx = Find-Tool @('npx', 'npx.cmd')
        if ($npm -and $npx) {
            Write-Host '==> yarn is not on PATH - falling back to npm + webpack'
            & $npm install --no-audit --no-fund | Out-Host
            if ($LASTEXITCODE -ne 0) { return $LASTEXITCODE }
            & $npm run clean | Out-Host
            if ($LASTEXITCODE -ne 0) { return $LASTEXITCODE }
            & $npx cross-env NODE_ENV=production ./node_modules/.bin/webpack --mode production | Out-Host
            return $LASTEXITCODE
        }

        Write-Host 'error: neither yarn, corepack nor npm is on PATH - cannot build the panel assets.' -ForegroundColor Red
        return 127
    }
    finally {
        Pop-Location
    }
}

if ($Build) {
    $code = Invoke-AssetBuild
    if ($code -ne 0) {
        Write-Host ''
        Write-Host "error: the files are installed, but building the panel assets failed (exit $code)." -ForegroundColor Red
        Write-Host 'Rebuild them yourself, then run this installer again with -Build:'
        Write-Host "  cd '$PanelPath'; yarn install --frozen-lockfile"
        Write-Host "  `$env:NODE_OPTIONS='--openssl-legacy-provider'; yarn build:production  # drop it on node 16 and older"
        Write-Host "  php artisan view:clear; php artisan cache:clear; php artisan config:clear"
        exit 1
    }

    Write-Host '==> clearing Laravel caches'
    $php = Find-Tool @('php', 'php.exe')
    if ($php) {
        Push-Location $PanelPath
        try {
            & $php artisan view:clear | Out-Host
            & $php artisan cache:clear | Out-Host
            & $php artisan config:clear | Out-Host
            & $php artisan route:clear | Out-Host
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Warning "php is not on PATH - clear the Laravel caches by hand: cd '$PanelPath'; php artisan view:clear; php artisan cache:clear; php artisan config:clear; php artisan route:clear"
    }

    Write-Host ''
    Write-Host 'brine-theme is live - hard-refresh the browser (Ctrl+Shift+R).'
}
else {
    Write-Host @"
Files installed. Now rebuild the panel and clear its caches:

  cd '$PanelPath'
  yarn install --frozen-lockfile
  `$env:NODE_OPTIONS='--openssl-legacy-provider'; yarn build:production  # drop it on node 16 and older
  php artisan view:clear; php artisan cache:clear; php artisan config:clear; php artisan route:clear

Then hard-refresh the browser (Ctrl+Shift+R).
"@
}

Write-Host ''
if ($null -ne $Backup) {
    Write-Host "Backup kept at: $Backup"
}
Write-Host "Rollback with:  .\install.ps1 -PanelPath '$PanelPath' -Uninstall"
Write-Host "Check status:   .\install.ps1 -PanelPath '$PanelPath' -Status"
