# brine-theme

A full UI overhaul of **Pterodactyl Panel** (v1.12 – v1.15) for the **Niraula
EduMedia** brand — navy `#1a3c6d` + gold `#c8a44e`, self-hosted Montserrat and
Playfair Display, and a restructured layout rather than a palette swap.

What it changes on top of the stock panel:

- **Shell** — Aternos-style fixed sidebar (brand block, permission-filtered
  server + account navigation, user footer), sticky navy topbar with a gold
  rule, and a sliding mobile drawer with a hamburger burger.
- **Dashboard** — branded hero header with welcome stats, section title, and
  server cards that carry a status chip, allocation chip and CPU/MEM/DISK
  stat blocks with colour bars.
- **Login** — the stock login is replaced with a navy masthead carrying the
  brand emblem, a gold rule and a Playfair heading (checkpoint, forgot and
  reset screens follow the same treatment).
- **Console** — terminal chrome (window bar, dots, title, command hint) in
  navy-black, neutral stat cards with gold accents, a branded header with a
  status chip, and a gold **Start** call-to-action.
- **File manager** — monospaced navy path bar with gold links, card-style file
  rows with icon tiles, and a branded selection bar.
- **Light/dark** — a toggle in the topbar (and in the admin navbar) flips
  `data-theme` live; the preference is stored in `localStorage` under
  `ptero-theme` and applied before first paint, so there is no flash of the
  wrong colours.

## Requirements

- A working Pterodactyl Panel install (the directory that contains `artisan`
  and `package.json`).
- Node/yarn available when you rebuild the frontend assets.
- PHP/artisan available to clear the Laravel caches.

## Preview

`preview/` is a static, offline mock of **both** halves of the panel. It runs
straight from disk — no database, no PHP, no build step:

```bash
# Windows
start preview\index.html      # React panel
start preview\admin.html      # AdminLTE admin area

# macOS
open preview/index.html

# Linux
xdg-open preview/index.html
```

Each page loads the real palette stylesheet
(`theme/public/themes/pterodactyl/css/pterodactyl-theme.css`), the bundled
fonts and a Tailwind build generated from this package's `tailwind.config.js`,
so every utility, border and alpha modifier on screen is what an installed
panel will render. The toggle in the topbar flips `data-theme` live — nothing
reloads. `admin.html` also runs the shipped `theme-toggle.js`.

The markup is hard-coded (no API) but mirrors the panel's real components and
the redesigned pages in this package.

Regenerate the preview stylesheet, icon map and font list after changing the
palette or `tailwind.config.js`:

```bash
node preview/build-preview.js --panel /path/to/pterodactyl/panel
```

> `preview/` is for eyeballing the theme only — it is **not** in
> `manifest.json`, so the installers never copy it into a panel.

## Install

### One command on a server

```bash
curl -fsSL https://raw.githubusercontent.com/brineajay-94/ptero-themes/main/setup.sh | sudo bash
```

Downloads the manager to `~/.brine-theme` (re-runs update it) and opens the
menu below. Drop `sudo` if your user already owns the panel files.

### One command (local clone)

The repo ships a single entry point that opens an interactive menu. Clone it,
`cd` into it, then run it:

```bash
# Linux / macOS
./brine
```

```bat
:: Windows (cmd / PowerShell)
brine
```

```
==============================================================
  brine-theme  -  Pterodactyl Panel theme manager   v1.0.0
--------------------------------------------------------------
  Panel  : /var/www/pterodactyl
  Status : NOT INSTALLED
==============================================================

  1) Install theme
  2) Status
  3) Update theme
  4) Uninstall (restore original panel)
  5) Change panel directory
  0) Exit

Choose [0-5]:
```

The panel directory is auto-detected (`$BRINE_PANEL`, `/var/www/pterodactyl`,
`/usr/local/pterodactyl`, `C:\inetpub\pterodactyl`, the current directory …) and
option `5` accepts any other path. After installing, updating or uninstalling,
the menu offers to rebuild the panel assets for you.

### Non-interactive

Every menu action is also a subcommand, so it works from scripts and CI:

```bash
./brine status    /var/www/pterodactyl   # exit 0 = installed, 3 = not installed
./brine install   /var/www/pterodactyl
./brine update    /var/www/pterodactyl
./brine uninstall /var/www/pterodactyl
```

```powershell
brine status    C:\inetpub\pterodactyl
brine install   C:\inetpub\pterodactyl
brine update    C:\inetpub\pterodactyl
brine uninstall C:\inetpub\pterodactyl
```

| Environment variable | Effect |
| --- | --- |
| `BRINE_PANEL` | Default panel directory (skips auto-detection). |
| `BRINE_BUILD` | `y` / `n` — rebuild assets without asking (non-interactive runs default to `n`). |

### Direct installer

The menu is a wrapper around the installers, which can still be called straight:

```bash
# Linux / macOS
./install.sh /var/www/pterodactyl --build      # install + rebuild
./install.sh /var/www/pterodactyl --update     # re-apply over an existing install
./install.sh /var/www/pterodactyl --status     # print status, exit 0 / 3
```

```powershell
# Windows
.\install.ps1 -PanelPath C:\inetpub\pterodactyl -Build
.\install.ps1 -PanelPath C:\inetpub\pterodactyl -Update
.\install.ps1 -PanelPath C:\inetpub\pterodactyl -Status
```

Without `--build` / `-Build` the installer only copies files and prints the
commands to run yourself.

**Always rebuild the frontend after installing** — `tailwind.config.js` is part
of the package, so the brand colour utilities (`navy`, `gold`, and the
`blue`/`primary`/`cyan` aliases) only exist in the bundle after a build:

```bash
cd /var/www/pterodactyl
yarn install --frozen-lockfile
yarn build:production
php artisan view:clear && php artisan cache:clear && php artisan config:clear
```

Then hard-refresh the browser (`Ctrl+Shift+R`).

> **Windows note:** the panel's `clean` script uses GNU `find`, which is not
> available in `cmd`/PowerShell. If `yarn build:production` fails on the `clean`
> step, build directly instead:
>
> ```
> npx cross-env NODE_ENV=production webpack --mode production
> ```

### Manual install

Copy every entry in `manifest.json` from `theme/` into the panel root,
preserving paths. Files marked `replace` overwrite panel files; `create` files
are new.

## Uninstall / rollback

Pick `4` in the menu, or run:

```bash
./brine uninstall /var/www/pterodactyl      # or: ./install.sh <panel> --uninstall
```

```powershell
brine uninstall C:\inetpub\pterodactyl      # or: .\install.ps1 -PanelPath <panel> -Uninstall
```

Every install writes a timestamped copy of the original files to
`<panel>/.pterodactyl-backup/<timestamp>/` and a state file to
`<panel>/.brine-theme.state`. Uninstall restores the most recent backup,
deletes the files the theme created and removes the state file. Rebuild and
clear the caches afterwards — the menu offers to do that too.

- A plain `install` refuses to run when the theme is already present, so a
  second run can never overwrite your backup with themed files.
- `update` re-applies the theme **without** touching the original backup, so
  uninstall always restores a clean panel.
- `status` (`./brine status` / `-Status`) reports `installed`, `partial` or
  `not-installed` and exits `0` / `3` for scripting.

## How it works

### Design tokens

`tailwind.config.js` emits every colour utility as `rgb(var(--pt-*))` instead of
a literal. The channel values live in
`public/themes/pterodactyl/css/pterodactyl-theme.css`, duplicated for
`:root[data-theme='dark']` and `:root[data-theme='light']`.

Because `<html data-theme="…">` selects which block applies, flipping that one
attribute re-themes every colour utility in the panel with **no rebuild** and no
full-page reload. Opacity modifiers (`bg-black/50`, `bg-red-500/25`) keep
working because Tailwind re-parses the `rgb()` wrapper itself.

### Brand ramps

The config exposes two new ramps read from the CSS variables:

| Ramp | Source | Used for |
| --- | --- | --- |
| `navy` | `--pt-navy-*` (600 = `26 60 109`) | brand surfaces, sidebar, topbar, terminals |
| `gold` | `--pt-gold-*` (600 = `200 164 78`) | accents, rules, active states, call-to-action |

`blue` and `primary` are **aliased to the navy ramp** and `cyan` is **aliased
to the gold ramp**, so every stock `text-blue-*`, `bg-primary-600`,
`border-cyan-500` and navigation underline rebrands with no component edits.
`red` / `green` / `yellow` keep their stock semantics for status and errors.

### Neutral ramp

The `neutral` / `gray` ramp is **mirrored** for the light theme (50 ↔ 900,
100 ↔ 800, 200 ↔ 700, 300 ↔ 600, 400 ↔ 500), with `neutral-700` becoming the
card surface and `neutral-800` the off-white page. The stock panel builds every
surface out of `neutral-700/800/900`, so inverting the ramp keeps every
`text-neutral-* on bg-neutral-*` pairing readable while the page turns light.
A handful of light-mode overrides at the end of the stylesheet handle the
places the mirror cannot (white text on white cards, disabled inputs,
backdrops).

### Fonts

`@font-face` declarations in the palette stylesheet load
`fonts/montserrat-latin-wght-normal.woff2` and
`fonts/playfair-display-latin-wght-normal.woff2` from
`public/themes/pterodactyl/fonts/` — self-hosted, no third-party request.
`fontFamily.sans` is Montserrat and `fontFamily.header` (`font-header`) is
Playfair Display, used for headings and server names.

### No-flash bootstrap

Both Blade templates (`templates/wrapper.blade.php` for the React panel,
`layouts/admin.blade.php` for the admin area) run a tiny inline script in `<head>`
that reads `localStorage['ptero-theme']` and sets `data-theme` on `<html>`
before any stylesheet or script has been parsed.

### Chart.js

Canvas does not resolve `var()`, so the console graphs cannot take Tailwind
colours directly. `ptColor()` in `resources/scripts/lib/theme.ts` reads the
token back out of the computed style and returns a literal `rgb()` / `rgba()`
string for Chart.js. Grid and tick colours are re-resolved on every chart
render, so they follow the current theme.

## What changes

38 files. Full detail lives in `manifest.json`; the summary:

**Build & chrome**

| File | Action |
| --- | --- |
| `tailwind.config.js` | replace — brand ramps + `rgb(var(--pt-*))` emitters |
| `resources/views/templates/wrapper.blade.php` | replace — title, favicon, theme-color, no-FOUC |
| `resources/views/layouts/admin.blade.php` | replace — stylesheet + admin toggle |
| `public/themes/pterodactyl/css/pterodactyl-theme.css` | create — tokens, fonts, shell/auth/dashboard/console/files |
| `public/themes/pterodactyl/js/theme-toggle.js` | create — admin toggle |
| `public/themes/pterodactyl/fonts/*.woff2` | create — Montserrat + Playfair Display |
| `public/themes/pterodactyl/images/{logo,favicon}.svg` | create — brand mark |

**Shell**

| File | Action |
| --- | --- |
| `resources/scripts/components/AppShell.tsx` | create — sidebar + topbar + drawer |
| `resources/scripts/components/Sidebar.tsx` | create — brand, nav, user footer |
| `resources/scripts/components/NavigationBar.tsx` | replace — rewritten as the topbar |
| `resources/scripts/routers/DashboardRouter.tsx` | replace — wraps in `AppShell` |
| `resources/scripts/routers/ServerRouter.tsx` | replace — wraps in `AppShell` |

**Pages**

| File | Action |
| --- | --- |
| `components/dashboard/{DashboardContainer,ServerRow}.tsx` | replace |
| `components/auth/{LoginFormContainer,LoginContainer,LoginCheckpointContainer,ForgotPasswordContainer,ResetPasswordContainer}.tsx` | replace |
| `routers/AuthenticationRouter.tsx` | replace |
| `components/elements/{PageContentBlock.tsx,button/style.module.css}` | replace |
| `components/server/console/{ServerConsoleContainer,PowerButtons,Console,StatBlock,StatGraphs,chart.ts,style.module.css}` | replace |
| `components/server/files/{FileManagerContainer,FileManagerBreadcrumbs,FileObjectRow,MassActionsBar,style.module.css}` | replace |

**Infrastructure carried over from the token work**

| File | Action |
| --- | --- |
| `resources/scripts/lib/theme.ts` | create — `getTheme` / `setTheme` / `toggleTheme` / `subscribeTheme` / `ptColor` |
| `resources/scripts/components/elements/ThemeToggle.tsx` | create — React toggle button |

Server-side rendering, permissions, API routes and the database are unaffected.

## Customising

- **Colours** — edit the token blocks at the top of
  `public/themes/pterodactyl/css/pterodactyl-theme.css`. Channel triplets are
  `R G B` separated by spaces (e.g. `--pt-gold-600: 200 164 78;`). Mirror the
  same edit into `tailwind.config.js` only if you add a *new* ramp.
- **Type** — swap the `.woff2` files under `public/themes/pterodactyl/fonts/`
  and update the `@font-face` `src` plus `--pt-font-body` / `--pt-font-heading`.
- **Default theme** — the bootstrap falls back to `prefers-color-scheme` on the
  React pages and to `dark` in the admin. Change it in the inline script in
  `wrapper.blade.php`.
- **Toggle placement** — `NavigationBar.tsx` wraps the button in
  `<span className="pt-theme-slot">`; move the whole span if you want it
  elsewhere.

## Known limitations

- Syntax highlighting in the file editor still uses stock hex literals, so those
  few colours do not follow the theme.
- Chart dataset colours (cyan/yellow) are captured when a chart is created.
  They are identical in both themes, so this is not visible in practice.
- Because `tailwind.config.js` is replaced, upgrading the panel may overwrite
  it (and the other `replace` entries). Uninstall, upgrade, then reinstall.
- The file editor and the activity/backup/admin sub-pages keep the stock
  layout; only their colours are rebranded through the token system.

## Verification

Checks run against a clean `pterodactyl/panel` v1.15.1 checkout with this
package installed:

- `tsc --noEmit` — passes.
- `eslint` on every touched TS/TSX/JS file — 0 errors (files are LF, matching
  `.editorconfig`; run Prettier from *inside* the panel checkout so the panel's
  `.prettierrc.json` is picked up).
- Production webpack build succeeds
  (`npx cross-env NODE_ENV=production webpack --mode production`).
- `php -l` on both Blade templates, `node --check` on `theme-toggle.js` and
  `tailwind.config.js`, brace/paren balance on the palette stylesheet.
- `install.sh` and `install.ps1` round-tripped against a fixture panel root,
  driven through the `brine` menu entry point on both platforms:
  status (not installed) → install → status (installed) → double install refused
  → update (single original backup kept, works only while installed) →
  uninstall → status (not installed), with every original file verified
  byte-identical to the pristine fixture afterwards.
