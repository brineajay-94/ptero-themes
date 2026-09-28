#!/usr/bin/env bash
#
# brine-theme installer for Pterodactyl Panel.
#
#   ./install.sh /var/www/pterodactyl              install
#   ./install.sh /var/www/pterodactyl --build      install, then compile panel assets
#   ./install.sh /var/www/pterodactyl --update     re-apply over an existing install
#   ./install.sh /var/www/pterodactyl --uninstall  restore the most recent backup
#   ./install.sh /var/www/pterodactyl --status     print install status (0 = installed, 3 = not)
#
set -euo pipefail

THEME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$THEME_DIR/theme"
MANIFEST="$THEME_DIR/manifest.json"
THEME_NAME="brine-theme"

PANEL_DIR=""
DO_BUILD=0
ACTION="install"

usage() {
    cat <<EOF
brine-theme installer

Usage: $(basename "$0") <panel-directory> [options]

Options:
  -b, --build       Run "yarn install --frozen-lockfile && yarn build:production"
                    and clear the Laravel view/cache after copying files.
  -u, --uninstall   Restore files from the most recent backup and remove the
                    files this theme created.
      --update      Re-apply the theme over an existing install (keeps the
                    original backup so uninstall still restores a clean panel).
      --status      Print the install status and exit (0 installed, 3 not).
  -h, --help        Show this help.

Backups are written to <panel-directory>/.pterodactyl-backup/<timestamp>/
Install state is written to <panel-directory>/.brine-theme.state
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        -b|--build) DO_BUILD=1 ;;
        -u|--uninstall) ACTION="uninstall" ;;
        --update) ACTION="update" ;;
        --status) ACTION="status" ;;
        -h|--help) usage; exit 0 ;;
        -*) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
        *) PANEL_DIR="$1" ;;
    esac
    shift
done

if [ -z "$PANEL_DIR" ]; then
    usage >&2
    exit 1
fi

PANEL_DIR="$(cd "$PANEL_DIR" && pwd)"

if [ ! -f "$PANEL_DIR/artisan" ] || [ ! -f "$PANEL_DIR/package.json" ]; then
    echo "error: '$PANEL_DIR' does not look like a Pterodactyl panel root (missing artisan/package.json)." >&2
    exit 1
fi

if [ ! -f "$MANIFEST" ]; then
    echo "error: manifest.json not found next to this script." >&2
    exit 1
fi

THEME_VERSION="$(awk -F'"' '/"version"/ { print $4; exit }' "$MANIFEST")"
STATE_FILE="$PANEL_DIR/.brine-theme.state"
THEME_MARKER="$PANEL_DIR/public/themes/pterodactyl/css/pterodactyl-theme.css"

# Read "path"/"action" pairs out of manifest.json without requiring jq.
PAIRS=()
while IFS= read -r line; do
    PAIRS+=("$line")
done < <(awk '
    /"path"/   { p = $0; sub(/.*"path": *"/, "", p); sub(/".*/, "", p) }
    /"action"/ { a = $0; sub(/.*"action": *"/, "", a); sub(/".*/, "", a); print p "\t" a }
' "$MANIFEST")

if [ "${#PAIRS[@]}" -eq 0 ]; then
    echo "error: could not parse any files out of manifest.json." >&2
    exit 1
fi

backup_dir() {
    printf '%s/.pterodactyl-backup/%s' "$PANEL_DIR" "$(date +%Y%m%d-%H%M%S)"
}

latest_backup() {
    ls -1d "$PANEL_DIR"/.pterodactyl-backup/*/ 2>/dev/null | sort | tail -n 1 || true
}

theme_present() {
    [ -f "$THEME_MARKER" ]
}

# installed | partial | not-installed
status_of() {
    local marker=0 state=0
    [ -f "$THEME_MARKER" ] && marker=1
    [ -f "$STATE_FILE" ] && state=1

    if [ "$marker" -eq 1 ] && [ "$state" -eq 1 ]; then
        echo installed
    elif [ "$marker" -eq 1 ] || [ "$state" -eq 1 ]; then
        echo partial
    else
        echo not-installed
    fi
}

write_state() {
    local mode="$1" backup="${2:-}"
    {
        echo "name=$THEME_NAME"
        echo "version=$THEME_VERSION"
        echo "installed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo "mode=$mode"
        echo "backup=$backup"
    } > "$STATE_FILE"
}

cmd_status() {
    local st version since
    st="$(status_of)"
    version="$(awk -F'"' '/"version"/ { print $4; exit }' "$STATE_FILE" 2>/dev/null || true)"
    since="$(awk -F= '/^installed_at=/ { print $2; exit }' "$STATE_FILE" 2>/dev/null || true)"

    case "$st" in
        installed)
            echo "status=installed"
            echo "theme=$THEME_NAME"
            echo "version=${version:-$THEME_VERSION}"
            echo "installed_at=${since:-unknown}"
            echo "panel=$PANEL_DIR"
            exit 0
            ;;
        partial)
            echo "status=partial"
            echo "theme=$THEME_NAME"
            echo "detail=theme files and state file disagree; run --update (or --uninstall) to fix"
            echo "panel=$PANEL_DIR"
            exit 3
            ;;
        *)
            echo "status=not-installed"
            echo "theme=$THEME_NAME"
            echo "panel=$PANEL_DIR"
            exit 3
            ;;
    esac
}

restore_latest_backup() {
    local latest
    latest="$(latest_backup)"
    if [ -z "$latest" ]; then
        echo "No backup found in $PANEL_DIR/.pterodactyl-backup/" >&2
        exit 1
    fi
    echo "Restoring from: $latest"
    cp -a "$latest." "$PANEL_DIR/"

    # Paths recorded at install time that had no panel original behind them.
    if [ -f "${latest}created.txt" ]; then
        while IFS= read -r path; do
            [ -n "$path" ] || continue
            rm -f "$PANEL_DIR/$path"
            echo "removed  $path"
        done < "${latest}created.txt"
    fi
    rm -f "$PANEL_DIR/created.txt"
}

do_uninstall() {
    if [ "$(status_of)" = "not-installed" ] && [ -z "$(latest_backup)" ]; then
        echo "brine-theme is not installed in $PANEL_DIR - nothing to restore." >&2
        exit 0
    fi

    restore_latest_backup

    # Remove files the theme created (they have no panel original to restore).
    while IFS=$'\t' read -r path action; do
        [ "$action" = "create" ] || continue
        rm -f "$PANEL_DIR/$path"
        echo "removed  $path"
    done < <(printf '%s\n' "${PAIRS[@]}")

    rm -f "$STATE_FILE"

    echo
    echo "brine-theme uninstalled - the panel is back to its original theme. Rebuild the assets:"
    echo "  cd '$PANEL_DIR' && yarn install --frozen-lockfile && yarn build:production"
    echo "  php artisan view:clear && php artisan cache:clear"
}

case "$ACTION" in
    status) cmd_status ;;
    uninstall) do_uninstall; exit 0 ;;
esac

if [ "$ACTION" = "update" ]; then
    if ! theme_present; then
        echo "error: brine-theme is not installed in $PANEL_DIR (run without --update first)." >&2
        exit 1
    fi
else
    if theme_present; then
        echo "brine-theme already appears to be installed in $PANEL_DIR." >&2
        echo "Use --update to re-apply, or '$(basename "$0") '$PANEL_DIR' --uninstall' to restore a clean panel." >&2
        exit 1
    fi
fi

BACKUP=""
if [ "$ACTION" = "install" ]; then
    BACKUP="$(backup_dir)"
    mkdir -p "$BACKUP"
    echo "Installing brine-theme into: $PANEL_DIR"
    echo "Backing up original files to: $BACKUP"
else
    BACKUP="$(latest_backup)"
    echo "Updating brine-theme in: $PANEL_DIR"
    if [ -n "$BACKUP" ]; then
        echo "Keeping the original backup (uninstall still restores it): $BACKUP"
    else
        echo "warning: no original backup found - uninstall will not be able to restore this panel." >&2
    fi
fi
echo

while IFS=$'\t' read -r path action; do
    target="$PANEL_DIR/$path"
    source="$SRC/$path"

    if [ ! -f "$source" ]; then
        echo "error: theme payload missing: $source" >&2
        exit 1
    fi

    if [ "$ACTION" = "install" ]; then
        if [ -f "$target" ]; then
            mkdir -p "$BACKUP/$(dirname "$path")"
            cp -a "$target" "$BACKUP/$path"
        else
            if [ "$action" != "create" ]; then
                echo "warning: expected an existing file at $path but none was found; it will be created." >&2
                echo "$path" >> "$BACKUP/created.txt"
            fi
        fi
    fi

    mkdir -p "$(dirname "$target")"
    cp -a "$source" "$target"
    echo "$(printf '%-8s' "$action") $path"
done < <(printf '%s\n' "${PAIRS[@]}")

write_state "$ACTION" "$BACKUP"
echo

# Node tooling often lives outside the PATH that sudo gives us (nvm, a
# different login user, /usr/local), so widen the search before building.
augment_path() {
    local d
    for d in \
        /usr/local/bin /usr/bin /bin /snap/bin \
        /usr/local/node*/bin /opt/node*/bin \
        /root/.nvm/versions/node/*/bin \
        /home/*/.nvm/versions/node/*/bin \
        /root/.local/share/yarn/bin /home/*/.local/share/yarn/bin \
        /root/.config/yarn/*/node_modules/.bin; do
        [ -d "$d" ] && PATH="$PATH:$d"
    done
    export PATH
    return 0
}

find_tool() {
    local c
    for c in "$@"; do
        if command -v "$c" >/dev/null 2>&1; then
            command -v "$c"
            return 0
        fi
    done
    return 1
}

manual_build_hint() {
    cat <<EOF
  cd '$1'
  yarn install --frozen-lockfile && yarn build:production
  php artisan view:clear && php artisan cache:clear && php artisan config:clear
EOF
}

# Compiles the panel assets with whatever tooling this machine actually has.
run_build() {
    augment_path
    local tool

    if tool="$(find_tool yarn)"; then
        echo "==> $tool install --frozen-lockfile && $tool build:production"
        (cd "$PANEL_DIR" && "$tool" install --frozen-lockfile && "$tool" build:production)
        return $?
    fi

    if tool="$(find_tool corepack)"; then
        echo "==> yarn is not on PATH - using corepack ($tool yarn ...)"
        (cd "$PANEL_DIR" && "$tool" yarn install --frozen-lockfile && "$tool" yarn build:production)
        return $?
    fi

    if tool="$(find_tool npm)"; then
        # package.json's build:production shells out to `yarn run clean`, so
        # npm alone cannot run it - drive the clean + webpack steps directly.
        echo "==> yarn is not on PATH - falling back to npm + webpack"
        (cd "$PANEL_DIR" && "$tool" install --no-audit --no-fund) || return $?
        (cd "$PANEL_DIR" && "$tool" run clean) || return $?
        if tool="$(find_tool npx)"; then
            (cd "$PANEL_DIR" && "$tool" cross-env NODE_ENV=production ./node_modules/.bin/webpack --mode production)
        else
            (cd "$PANEL_DIR" && NODE_ENV=production ./node_modules/.bin/webpack --mode production)
        fi
        return $?
    fi

    echo "error: neither yarn, corepack nor npm is on PATH - cannot build the panel assets." >&2
    return 127
}

if [ "$DO_BUILD" -eq 1 ]; then
    if run_build; then
        echo "==> clearing Laravel caches"
        if tool="$(find_tool php)"; then
            (cd "$PANEL_DIR" && "$tool" artisan view:clear && "$tool" artisan cache:clear && "$tool" artisan config:clear)
        else
            echo "warning: php is not on PATH - clear the Laravel caches by hand:" >&2
            echo "  cd '$PANEL_DIR' && php artisan view:clear && php artisan cache:clear && php artisan config:clear" >&2
        fi
        echo
        echo "brine-theme is live - hard-refresh the browser (Ctrl+Shift+R)."
    else
        code=$?
        echo
        echo "error: the files are installed, but building the panel assets failed (exit $code)." >&2
        echo "Rebuild them yourself, then run the installer again with --build:" >&2
        manual_build_hint "$PANEL_DIR"
        exit 1
    fi
else
    cat <<EOF
Files installed. Now rebuild the panel and clear its caches:

  cd '$PANEL_DIR'
  yarn install --frozen-lockfile && yarn build:production
  php artisan view:clear && php artisan cache:clear && php artisan config:clear

Then hard-refresh the browser (Ctrl+Shift+R).
EOF
fi

echo
if [ -n "$BACKUP" ]; then
    echo "Backup kept at: $BACKUP"
fi
echo "Rollback with:  $(basename "$0") '$PANEL_DIR' --uninstall"
echo "Check status:   $(basename "$0") '$PANEL_DIR' --status"
