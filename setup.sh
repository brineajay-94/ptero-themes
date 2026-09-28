#!/usr/bin/env bash
#
# One-shot bootstrap for the brine-theme install menu.
#
#   curl -fsSL https://raw.githubusercontent.com/brineajay-94/ptero-themes/main/setup.sh | bash
#
# Clones (or updates) the manager and opens the interactive menu:
#   1 Install   2 Status   3 Update   4 Uninstall   5 Change panel   0 Exit
#
set -euo pipefail

REPO="${BRINE_REPO:-https://github.com/brineajay-94/ptero-themes.git}"
DEST="${BRINE_DIR:-$HOME/.brine-theme}"

if ! command -v git >/dev/null 2>&1; then
    echo "error: git is required - install it first (apt install git / dnf install git)." >&2
    exit 1
fi

if [ -d "$DEST/.git" ]; then
    echo "Updating $DEST ..."
    git -C "$DEST" pull --ff-only --quiet || echo "warning: could not fast-forward $DEST - using what is there." >&2
else
    echo "Downloading brine-theme manager to $DEST ..."
    rm -rf "$DEST"
    git clone --depth 1 "$REPO" "$DEST"
fi

cd "$DEST"

if [ "${BRINE_NONINTERACTIVE:-n}" = "y" ]; then
    echo "Manager ready at: $DEST"
    echo "Run it with:      $DEST/brine"
    exit 0
fi

# stdin came from curl, so re-attach the terminal before prompting.
if { true < /dev/tty; } 2>/dev/null; then
    exec ./brine < /dev/tty
fi

echo "Manager ready at: $DEST"
echo "No interactive terminal detected - run one of:"
echo "  $DEST/brine status    /var/www/pterodactyl"
echo "  $DEST/brine install   /var/www/pterodactyl"
echo "  $DEST/brine uninstall /var/www/pterodactyl"
