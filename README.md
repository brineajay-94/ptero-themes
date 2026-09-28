# brine-theme

A full UI overhaul of **Pterodactyl Panel** (v1.12 – v1.15) matching the **Aternos**
control-panel design — dark `#1a1f24` page, `#2d3943` surfaces, blue `#2b87d3`
accent, the system UI font stack, and a fixed sidebar shell.

What it changes on top of the stock panel:

- **Shell** â€” Aternos-style fixed sidebar (brand block, permission-filtered
  server + account navigation, user footer), sticky topbar with a blue
  rule, and a sliding mobile drawer with a hamburger burger.
- **Dashboard** â€” branded hero header with welcome stats, section title, and
  server cards that carry a status chip, allocation chip and CPU/MEM/DISK
  stat blocks with colour bars.
- **Login** — the stock login is replaced with a compact square card: navy masthead
  with the brand emblem, gold rule, system-font heading, one-screen height
  (checkpoint, forgot and reset screens follow the same treatment).
- **Registration** — a public sign-up page (`/auth/register`) with email, first
  and last name, username, password and confirm-password. It appears behind a
  "Don't have an account? Register here" link on the login card only when the
  admin enables it; new users are created through the panel's own Application
  API with a key saved under **Admin -> Registration**.
- **Console** â€” terminal chrome (window bar, dots, title, command hint) in
  navy-black, neutral stat cards with blue accents, a branded header with a
  status chip, and a green **Start** call-to-action.
- **File manager** â€” monospaced path bar with blue links, card-style file
  rows with icon tiles, and a branded selection bar.
- **Dark only** - one scheme matching `aternos-panel.html`: no light palette and
  no light/dark toggle anywhere in the panel.

## Scope

- The **normal user panel** (React) is re-skinned: fixed sidebar shell, dashboard,
  login, console and file manager.
- The **admin area** (AdminLTE) keeps its stock look, with exactly two additions:
  a **Branding** page (`/admin/branding`) where you upload your hosting logo, and
  a **Registration** page (`/admin/registration`) that switches public sign-up on
  or off and stores the Application API key used to create accounts.
- The **page title** stays exactly as Pterodactyl ships it. The **favicon** is the
  logo uploaded on the Branding page (falling back to the theme emblem) - the stock
  `/favicons` folder is removed on install and restored on uninstall.
- The **brand name** (sidebar, topbar subtitle, login card, footer) is read from
  the panel's own name setting - `config('app.name')`, exposed to the client as
  `window.SiteConfiguration.name` via `resources/scripts/lib/brand.ts`. Nothing is
  hardcoded, so renaming the panel rebrands the theme automatically.

## Requirements

- A working Pterodactyl Panel install (the directory that contains `artisan`
  and `package.json`).
- Node.js available when you rebuild the frontend assets (`yarn`, `corepack`
- PHP/artisan available to clear the Laravel caches.

## Preview

`preview/` is a static, offline mock of the user panel. It runs
straight from disk â€” no database, no PHP, no build step:

```bash
# Windows
start preview\index.html      # React user panel

# macOS
open preview/index.html

# Linux
xdg-open preview/index.html
```

Each page loads the real palette stylesheet
(`theme/public/themes/pterodactyl/css/pterodactyl-theme.css`), the bundled
fonts and a Tailwind build generated from this package's `tailwind.config.js`,
so every utility, border and alpha modifier on screen is what an installed
panel will render. There is no toggle: the mock renders one dark scheme.

The markup is hard-coded (no API) but mirrors the panel's real components and
the redesigned pages in this package.

Regenerate the preview stylesheet, icon map and font list after changing the
palette or `tailwind.config.js`:

```bash
node preview/build-preview.js --panel /path/to/pterodactyl/panel
```

> `preview/` is for eyeballing the theme only â€” it is **not** in
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
  6) Clear all cache
  0) Exit

Choose [0-6]:
```

The panel directory is auto-detected (`$BRINE_PANEL`, `/var/www/pterodactyl`,
`/usr/local/pterodactyl`, `C:\inetpub\pterodactyl`, the current directory â€¦) and
option `5` accepts any other path. Option `6` runs every Laravel cache clear
(`view`, `config`, `route`, `cache`, `event`) against the panel. After
installing, updating or uninstalling, the menu offers to rebuild the panel
assets for you.

### Non-interactive

Every menu action is also a subcommand, so it works from scripts and CI:

```bash
./brine status    /var/www/pterodactyl   # exit 0 = installed, 3 = not installed
./brine install   /var/www/pterodactyl
./brine update    /var/www/pterodactyl
./brine uninstall /var/www/pterodactyl
./brine clear-cache /var/www/pterodactyl # view + config + route + cache + event
```

```powershell
brine status    C:\inetpub\pterodactyl
brine install   C:\inetpub\pterodactyl
brine update    C:\inetpub\pterodactyl
brine uninstall C:\inetpub\pterodactyl
brine clear-cache C:\inetpub\pterodactyl
```

| Environment variable | Effect |
| --- | --- |
| `BRINE_PANEL` | Default panel directory (skips auto-detection). |
| `BRINE_BUILD` | `y` / `n` â€” rebuild assets without asking (non-interactive runs default to `n`). |

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

**Always rebuild the frontend after installing** â€” `tailwind.config.js` is part
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
clear the caches afterwards â€” the menu offers to do that too.

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
`public/themes/pterodactyl/css/pterodactyl-theme.css`, in a single `:root` block (dark only), taken from the Aternos reference mock. Because the token values live in CSS rather than in the compiled utility classes, a palette tweak needs only a stylesheet refresh - no rebuild. Opacity modifiers (`bg-black/50`, `bg-red-500/25`) keep working because Tailwind re-parses the `rgb()` wrapper itself. Opacity modifiers (`bg-black/50`, `bg-red-500/25`) keep
working because Tailwind re-parses the `rgb()` wrapper itself.

### Brand ramps

The config exposes two new ramps read from the CSS variables:

| Ramp | Source | Used for |
| --- | --- | --- |
| `navy` | `--pt-navy-*` (600 = `43 135 211` = `#2b87d3`) | primary surfaces, sidebar, topbar, primary buttons |
| `gold` | `--pt-gold-*` (600 = `43 135 211` = `#2b87d3`) | accent alias: links, rules, focus, active states |

`blue` and `primary` are **aliased to the navy ramp** and `cyan` is **aliased
to the gold ramp**, so every stock `text-blue-*`, `bg-primary-600`,
`border-cyan-500` and navigation underline rebrands with no component edits.
`red` / `green` / `yellow` keep their stock semantics for status and errors.

### Neutral ramp

The `neutral` / `gray` ramp is the Aternos dark ramp, read off the reference
mock: `700` is the card/sidebar/header surface (`#2d3943`), `800` the page
(`#1a1f24`), `900` raised chrome (`#161b22`), `black` the terminal
(`#0d1117`), and the upper steps are the text greys (`#e0e0e0` down to
`#7a8490`). The stock panel builds every surface from
`neutral-700/800/900`, so the whole panel lands on the reference colours
without per-page overrides.

### Fonts

The system UI stack (`-apple-system`, `BlinkMacSystemFont`, `Segoe UI`,
Roboto, `Helvetica Neue`, Arial) for both `--pt-font-body` and
`--pt-font-heading`, matching `fontFamily.sans` / `fontFamily.header` in
`tailwind.config.js`. No webfonts ship, so there is no font request and the
first paint is instant.


### Chart.js

Canvas does not resolve `var()`, so the console graphs cannot take Tailwind
colours directly. `ptColor()` in `resources/scripts/lib/theme.ts` reads the
token back out of the computed style and returns a literal `rgb()` / `rgba()`
string for Chart.js. Grid and tick colours are re-resolved on every chart
render, so they match the panel.

## What changes

44 files. Full detail lives in `manifest.json`; the summary:

**Build & chrome**

| File | Action |
| --- | --- |
| `tailwind.config.js` | replace â€” brand ramps + `rgb(var(--pt-*))` emitters |
| `resources/views/templates/wrapper.blade.php` | replace â€” stylesheet link only (title, favicon and meta tags stay stock) |
| `public/themes/pterodactyl/css/pterodactyl-theme.css` | create â€” Aternos tokens + shell/auth/dashboard/console/files styles |
| `public/themes/pterodactyl/images/logo.svg` | create â€” brand mark |

**Shell**

| File | Action |
| --- | --- |
| `resources/scripts/components/AppShell.tsx` | create â€” sidebar + topbar + drawer |
| `resources/scripts/components/Sidebar.tsx` | create â€” brand, nav, user footer |
| `resources/scripts/components/NavigationBar.tsx` | replace â€” rewritten as the topbar |
| `resources/scripts/routers/DashboardRouter.tsx` | replace â€” wraps in `AppShell` |
| `resources/scripts/routers/ServerRouter.tsx` | replace â€” wraps in `AppShell` |

**Pages**

| File | Action |
| --- | --- |
| `components/dashboard/{DashboardContainer,ServerRow}.tsx` | replace |
| `components/auth/{LoginFormContainer,LoginContainer,LoginCheckpointContainer,ForgotPasswordContainer,ResetPasswordContainer}.tsx` | replace |
| `components/auth/RegisterContainer.tsx` | create - public sign-up form |
| `api/auth/register.ts` | create - CSRF + `POST /auth/register` |
| `routers/AuthenticationRouter.tsx` | replace |
| `components/elements/{PageContentBlock.tsx,button/style.module.css}` | replace |
| `components/server/console/{ServerConsoleContainer,PowerButtons,Console,StatBlock,StatGraphs,chart.ts,style.module.css}` | replace |
| `components/server/files/{FileManagerContainer,FileManagerBreadcrumbs,FileObjectRow,MassActionsBar,style.module.css}` | replace |

**Infrastructure carried over from the token work**

| File | Action |
| --- | --- |
| `app/Http/Controllers/Admin/BrandingController.php` | create - logo upload/remove |
| `resources/views/admin/branding.blade.php` | create - Admin -> Branding page |
| `app/Http/Controllers/Admin/RegistrationController.php` | create - enable sign-up + save the Application API key |
| `resources/views/admin/registration.blade.php` | create - Admin -> Registration page |
| `app/Http/Controllers/Auth/RegisterController.php` | create - `POST /auth/register` creates the user via the Application API |
| `app/Http/ViewComposers/AssetComposer.php` | replace - exposes `SiteConfiguration.logo` and `SiteConfiguration.registration` |
| `routes/auth.php` | replace - stock routes + `GET/POST /auth/register` |
| `routes/admin.php` | replace - stock routes + `/admin/branding` + `/admin/registration` |
| `resources/views/layouts/admin.blade.php` | replace - Branding + Registration menu items, logo favicon |
| `resources/scripts/lib/brand.ts` | create - `brandName()`/`logoUrl()`/`registrationEnabled()` from `SiteConfiguration` |
| `resources/scripts/lib/theme.ts` | create â€” `ptColor` (Chart.js helper; dark-only, no theme state) |

Server-side rendering, permissions, API routes and the database are unaffected.

## Customising

- **Hosting logo** - Admin -> **Branding** uploads your logo to
  `public/themes/pterodactyl/images/custom-logo.<ext>`. The login emblem and the
  favicon (user panel + admin) come from that file; remove it there to fall back
  to the theme emblem. The stock `public/favicons` folder is moved into the
  backup on install and restored on uninstall.
- **Branding** - set the panel name in `config/app.php` / `.env` (`APP_NAME`) or
  wherever your deployment defines it; the sidebar, topbar, login card and footer
  all pick it up through `brandName()`.
- **Registration** - Admin -> **Registration** to turn public sign-up on or off
  and paste an Application API key (Admin -> Application API -> Create New). The
  login card only shows the register link while the switch is on, and the key is
  stored in panel settings (`Brine::registration_api_key`), never in the code.
- **Colours** â€” edit the token blocks at the top of
  `public/themes/pterodactyl/css/pterodactyl-theme.css`. Channel triplets are
  `R G B` separated by spaces (e.g. `--pt-gold-600: 200 164 78;`). Mirror the
  same edit into `tailwind.config.js` only if you add a *new* ramp.
- **Type** - edit `--pt-font-body` / `--pt-font-heading` in the stylesheet; the
  system stack ships with no `.woff2` files.

## Known limitations

- Syntax highlighting in the file editor still uses stock hex literals, so those
  few colours do not follow the theme.
- Chart dataset colours (cyan/yellow) are captured when a chart is created.
  They match the dark palette, so this is not visible in practice.
- Because `tailwind.config.js` is replaced, upgrading the panel may overwrite
  it (and the other `replace` entries). Uninstall, upgrade, then reinstall.
- The file editor and the activity/backup/admin sub-pages keep the stock
  layout; only their colours are rebranded through the token system.

## Verification

Checks run against a clean `pterodactyl/panel` v1.15.1 checkout with this
package installed:

- `tsc --noEmit` â€” passes.
- `eslint` on every touched TS/TSX/JS file â€” 0 errors (files are LF, matching
  `.editorconfig`; run Prettier from *inside* the panel checkout so the panel's
  `.prettierrc.json` is picked up).
- Production webpack build succeeds
  (`npx cross-env NODE_ENV=production webpack --mode production`).
- `php -l` on the Blade template, `node --check` on `tailwind.config.js`, and brace/paren balance
  on the palette stylesheet.
- `install.sh` and `install.ps1` round-tripped against a fixture panel root,
  driven through the `brine` menu entry point on both platforms:
  status (not installed) â†’ install â†’ status (installed) â†’ double install refused
  â†’ update (single original backup kept, works only while installed) â†’
  uninstall â†’ status (not installed), with every original file verified
  byte-identical to the pristine fixture afterwards.

