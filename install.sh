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

# The user PHP runs as. Every file below is copied with `cp -a` under sudo, which
# preserves ownership and therefore lands the whole payload as root:root. That
# is not fatal for the read-only assets, but the panel has to write into
# public/themes/pterodactyl/images (the admin-uploaded icon) and
# .../backgrounds (the uploaded hero images). A root-owned 755 directory makes
# the Site Settings upload fail with "not writable by PHP" no matter what the
# admin does in the browser, so the payload is handed to this user at the end.
#
# Detected rather than hardcoded: panels run under www-data, nginx, apache,
# httpd, pgsql, or a container's own uid, and a wrong guess here is what caused
# the failure in the first place.
detect_web_user() {
    local candidate

    # 1. The owner of the panel's own storage is what the app already writes as.
    if [ -d "$PANEL_DIR/storage" ]; then
        candidate="$(stat -c '%U' "$PANEL_DIR/storage" 2>/dev/null || true)"
        if [ -n "$candidate" ] && [ "$candidate" != "root" ]; then
            echo "$candidate"
            return 0
        fi
    fi

    # 2. The owner of public/assets, written by the asset build.
    for candidate in "$PANEL_DIR/public/assets" "$PANEL_DIR/public/themes" "$PANEL_DIR/bootstrap/cache"; do
        [ -d "$candidate" ] || continue
        candidate="$(stat -c '%U' "$candidate" 2>/dev/null || true)"
        if [ -n "$candidate" ] && [ "$candidate" != "root" ]; then
            echo "$candidate"
            return 0
        fi
    done

    # 3. Fall back to the usual suspects, in order of likelihood.
    for candidate in www-data nginx apache httpd pgsql; do
        if id -u "$candidate" >/dev/null 2>&1; then
            echo "$candidate"
            return 0
        fi
    done

    return 1
}

WEB_USER="$(detect_web_user || true)"

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

    # A file the theme used to ship and no longer does. It has no payload, so this
    # branch has to come BEFORE the payload check below - otherwise a manifest
    # entry with no file behind it reads as a broken install rather than as the
    # instruction it is.
    #
    # Backing up before deleting is what makes uninstall able to put it back:
    # restore_latest_backup copies the whole backup tree over the panel root.
    # But only an `install` has a backup directory to write into - `--update`
    # deliberately keeps the ORIGINAL backup instead of making a new one, so
    # $BACKUP is empty there. Copying into it anyway would expand "$BACKUP/app" to
    # "/app" and, under `set -e`, abort the whole run on a permission error. So
    # the backup is guarded on both the mode and the directory being real.
    #
    # On an update the file is simply deleted. That is safe: it was a file this
    # theme created, so the panel has no original of its own to lose, and it is
    # being removed because nothing references it any more.
    if [ "$action" = "remove" ]; then
        if [ ! -f "$target" ]; then
            echo "$(printf '%-8s' "$action") $path  (not on the panel, nothing to do)"
            continue
        fi

        if [ "$ACTION" = "status" ]; then
            echo "$(printf '%-8s' "$action") $path  (still on the panel - re-run without --status to remove it)"
            continue
        fi

        if [ "$ACTION" = "install" ] && [ -n "$BACKUP" ]; then
            mkdir -p "$BACKUP/$(dirname "$path")"
            cp -a "$target" "$BACKUP/$path"
            echo "$(printf '%-8s' "$action") $path  (removed; backup kept so uninstall can restore it)"
        else
            echo "$(printf '%-8s' "$action") $path  (removed)"
        fi

        rm -f "$target"
        continue
    fi

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

# Hand the payload to the user PHP runs as. See detect_web_user for why this
# matters: `cp -a` under sudo preserves root ownership, and without this the
# admin-uploaded icon can never be written because images/ is root-owned.
#
# backgrounds/ is not in the manifest - the controller creates it on first use -
# so it is created here too, otherwise the first background upload hits the same
# wall one directory over.
THEME_PUBLIC="$PANEL_DIR/public/themes/pterodactyl"
if [ -n "$WEB_USER" ]; then
    chown -R "$WEB_USER":"$(id -gn "$WEB_USER")" "$THEME_PUBLIC" 2>/dev/null || true
    mkdir -p "$THEME_PUBLIC/images" "$THEME_PUBLIC/backgrounds"
    # `|| true` here for the same reason as the line above, and its absence was a
    # real bug: this chown had no guard, so on a host where it is refused - a
    # non-root run, a panel on NFS or a container with a read-only uid map - `set
    # -e` aborted the installer HERE. That is after every file was copied but
    # before write_state, so the panel was left fully installed with no state file
    # and no backup marker: the next run called it "already installed" and
    # uninstall had nothing to restore from. Ownership is a convenience here, not
    # a correctness requirement, so a refusal is reported and stepped over.
    if ! chown -R "$WEB_USER":"$(id -gn "$WEB_USER")" "$THEME_PUBLIC/images" "$THEME_PUBLIC/backgrounds" 2>/dev/null; then
        echo "warning: could not set ownership on images/ and backgrounds/ to $WEB_USER." >&2
        echo "         set it by hand: chown -R $WEB_USER $THEME_PUBLIC" >&2
    fi
    # 775, not 755: the group is the panel's own group, so this lets an admin
    # group member write too without opening the directory to everyone.
    chmod 775 "$THEME_PUBLIC/images" "$THEME_PUBLIC/backgrounds"
    echo "ownership  public/themes/pterodactyl/{images,backgrounds} -> $WEB_USER (775)"
else
    mkdir -p "$THEME_PUBLIC/images" "$THEME_PUBLIC/backgrounds"
    chmod 777 "$THEME_PUBLIC/images" "$THEME_PUBLIC/backgrounds"
    echo "warning: could not detect the user PHP runs as; images/ and backgrounds/ were made world-writable." >&2
    echo "         set them to the panel user by hand: chown -R <user> $THEME_PUBLIC" >&2
fi

# The stock /favicons are no longer referenced anywhere (the admin-uploaded
# logo is the favicon now), so take them out of the panel. They land inside the
# backup, which restore_latest_backup copies straight back on uninstall.
if [ "$ACTION" = "install" ] && [ -d "$PANEL_DIR/public/favicons" ]; then
    mkdir -p "$BACKUP/public"
    mv "$PANEL_DIR/public/favicons" "$BACKUP/public/favicons"
    echo "removed  public/favicons (kept in the backup for uninstall)"
fi

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
  yarn install --frozen-lockfile
  NODE_OPTIONS=--openssl-legacy-provider yarn build:production
  php artisan view:clear && php artisan cache:clear && php artisan config:clear
  (drop the NODE_OPTIONS prefix if node --version reports 16 or older)
EOF
}

# Node 17+ ships OpenSSL 3, which refuses the md4 hashing webpack's css-loader
# does (error:0308010C digital envelope routines::unsupported). Opt builds back
# into the legacy provider on those versions; node < 17 rejects the flag, so it
# is only ever added when the major version warrants it - and never twice.
maybe_legacy_openssl() {
    if [ -n "${NODE_OPTIONS:-}" ] && printf '%s' "$NODE_OPTIONS" | grep -q -- '--openssl-legacy-provider'; then
        return 0
    fi
    major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" || major=''
    [ -n "$major" ] || return 0
    if [ "$major" -ge 17 ] 2>/dev/null; then
        export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--openssl-legacy-provider"
        echo "==> node $major detected - adding --openssl-legacy-provider to NODE_OPTIONS"
    fi
    return 0
}

# Compiles the panel assets with whatever tooling this machine actually has.
run_build() {
    augment_path
    maybe_legacy_openssl
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
  yarn install --frozen-lockfile
  NODE_OPTIONS=--openssl-legacy-provider yarn build:production
  php artisan view:clear && php artisan cache:clear && php artisan config:clear
  (drop the NODE_OPTIONS prefix if node --version reports 16 or older)

Then hard-refresh the browser (Ctrl+Shift+R).
EOF
fi

echo
if [ -n "$BACKUP" ]; then
    echo "Backup kept at: $BACKUP"
fi
echo "Rollback with:  $(basename "$0") '$PANEL_DIR' --uninstall"
echo "Check status:   $(basename "$0") '$PANEL_DIR' --status"
