# brine-theme

A full UI overhaul of **Pterodactyl Panel** (v1.12 – v1.15) with the **Aternos**
control-panel layout and a dark violet/indigo palette — `#19152e` page,
`#2b254c` surfaces, blue `#2b87d3` accent, the system UI font stack, a fixed
sidebar shell and frosted glass surfaces over a violet/cyan aurora.

What it changes on top of the stock panel:

- **Glass** — the sidebar, topbar, mobile drawer and login card are genuinely
  frosted (`backdrop-filter: blur + saturate`) over a fixed field of violet and
  cyan blooms that sit behind every screen. Cards, the dashboard hero and the
  console header use the same material vocabulary — hairline border, top inner
  highlight, tinted fill — but deliberately **without** a blur: one
  `backdrop-filter` per row of a scrolling server list is the single most
  expensive thing you can put on a panel. Corners are rounded again on the
  frosted surfaces only; dense, unstyled areas stay square.
  Users who ask for less transparency (`prefers-reduced-transparency`) or run
  Windows high contrast (`forced-colors`) get opaque surfaces automatically.
- **Shell** — Aternos-style fixed sidebar (brand block, permission-filtered
  server + account navigation, user footer), sticky topbar with a violet→blue
  gradient hairline, and a sliding mobile drawer with a hamburger burger.
- **Dashboard** — branded hero header with section title, and
  server cards that carry a status chip, allocation chip and CPU/MEM/DISK
  stat blocks with colour bars.
- **Login** — a modern floating auth card, centred both ways on the page: soft
  accent glow on the dark backdrop, a white logo chip instead of the old
  coloured masthead, an uppercase brand eyebrow, a strong "Welcome back" title,
  dark inputs with a navy focus ring and a full-width accent button (checkpoint,
  forgot and reset screens follow the same treatment).
- **Registration** — a public sign-up page (`/auth/register`) with email, first
  and last name, username, password and confirm-password. It appears behind a
  "Don't have an account? Register here" link on the login card only when the
  admin enables it; accounts are created directly by the panel's own user
  service (hashed password, welcome e-mail, activity log) — no API key.
- **Console** â€” terminal chrome (window bar, dots, title, command hint) in
  navy-black, neutral stat cards with blue accents, a branded header with a
  status chip, and a green **Start** call-to-action.
- **File manager** â€” monospaced path bar with blue links, card-style file
  rows with icon tiles, and a branded selection bar.
- **Dark only** - one scheme matching `aternos-panel.html`: no light palette and
  no light/dark toggle anywhere in the panel.
- **No reCAPTCHA** - the login, register and forgot-password forms do not render
  a captcha, and the auth routes do not run the stock `recaptcha` middleware.
  This is a bug fix, not a preference: the panel ships Google's **public**
  reCAPTCHA keys (`config/recaptcha.php: _shipped_*`), identical in every
  Pterodactyl install, so the free quota is shared across all of them. Once it
  is exhausted no token can be produced, and the middleware rejects every
  submission with HTTP 400 - which locks everyone out of the login form. The
  `throttle:authentication` rate limiter stays on all three endpoints, so
  brute-force attempts are still limited. Both files carry instructions for
  restoring the captcha once you have your own keys.

## Scope

- The **normal user panel** (React) is re-skinned: fixed sidebar shell, dashboard,
  login, console and file manager.
- The **admin area** (AdminLTE) keeps its stock look, with exactly two additions:
  - **Site Settings** (`/admin/site-settings`) — two tabs, both server-rendered
    so they work with no JavaScript. **General** is a stack of independent blocks,
    each with its own **Save** button:
    - **Name & icon** — the site name, and the icon as an **uploaded file or
      pasted image link** (PNG, SVG, JPG, ICO, GIF, WEBP), with a live preview.
    - **Login & register background** — an on/off switch, an **uploaded file or
      pasted image link** (PNG, JPG, GIF, WEBP, SVG), an **intensity slider** for
      the black scrim and a live preview, defaulting to 78%.
    - **Dashboard background** — the same controls, defaulting to 62%.

    Each background is saved through its own endpoint (`/background/{slot}`), so
    saving one can no longer switch the other one off. **Links** sets up to three
    quick links — **Home**, **Discord**, **Status** — each with a URL and an
    on/off switch.
  - **Registration** (`/admin/registration`) — switches public sign-up on or off.

  The page is responsive: the blocks stack full-width on a phone, the preview
  sits beside its controls on desktop, and the range input stays full-width so
  it is usable on touch.
- **Quick links** — the enabled links appear as buttons above the login and
  register forms. A `Home / Login` (or `Home / Register`) breadcrumb sits in the
  page's top-left corner, pinned to the viewport rather than to the card.
  **Discord** and **Status** also appear as icons in the dashboard topbar, next
  to a **Home** button. Disabling a link in the admin removes the button
  entirely. The Discord glyph is the real brand mark, inlined as SVG — the panel
  only ships FontAwesome's *solid* set, so the Discord icon is not available as
  a dependency and the theme does not add one just for it.

- **Slim dashboard topbar** — a three-column grid: burger and title on the left,
  then **Home · Discord · Status** centred as a row of glass pills, then a
  balancing spacer. The pills carry a soft resting treatment that strengthens on
  hover, and Discord keeps its brand blurple so it reads as Discord at a glance.
  Search, the admin shortcut, the account avatar, sign-out and the old dashboard
  shortcut are gone from the bar. Account and Admin Area are sidebar entries,
  and sign-out is the button at the bottom of the sidebar (and the mobile
  drawer), so all of it is still one click away — **except search, which had no
  other home and is therefore removed from the panel entirely.**

- **Branding in the sidebar** — the site icon beside the panel name is shown as
  it is: no chip, no background, no box. It falls back to the first letter of the
  panel name when no icon has been uploaded.
- The **page title** stays exactly as Pterodactyl ships it. The **favicon** is the
  icon uploaded on the Site Settings page (falling back to the theme emblem) - the
  stock `/favicons` folder is removed on install and restored on uninstall.
- The **brand name** (sidebar, topbar subtitle, login card, footer) is read from
  the panel's own name setting - `config('app.name')`, exposed to the client as
  `window.SiteConfiguration.name` via `resources/scripts/lib/brand.ts`. Nothing is
  hardcoded, so renaming the panel rebrands the theme automatically.

## Requirements

- A working Pterodactyl Panel install (the directory that contains `artisan`
  and `package.json`), Pterodactyl **1.12 – 1.15**, on **Tailwind 2.1 or newer**
  (the panel's own stylesheets use `bg-*/75`-style opacity modifiers, which the
  pre-2.1 classic engine cannot parse).
- Node.js available when you rebuild the frontend assets. Node **17 or newer**
  also needs `NODE_OPTIONS=--openssl-legacy-provider`, because webpack hashes
  with md4 and OpenSSL 3 dropped it — `install.sh`/`install.ps1` add the flag
  automatically when they detect node 17+, and drop it on older versions.
- PHP/artisan available to clear the Laravel caches.

### Frontend compatibility

`tailwind.config.js` is replaced, so it adapts to the Tailwind the panel has
installed:

| Installed Tailwind | Panels | What the config emits |
| --- | --- | --- |
| 2.1 / 2.2 | Blueprint-era panels | `mode: 'jit'` + `purge`, palette baked in as hex |
| 3.0.x | 1.12 – 1.13 with an old lockfile | `content`, palette baked in as hex |
| 3.1+ | 1.14 – 1.15 | `content`, palette as `rgb(var(--pt-*))` |

Tailwind 3.0.x and 2.x cannot apply an opacity modifier (`bg-blue-500/75`) to a
colour stored in a CSS variable, which is what the stock panel stylesheets use;
those engines get literal hex instead — the same colours, frozen at build time.
The console also drops the optional `xterm-addon-unicode11` package, so the
build does not depend on a dependency older panels do not ship.


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

The `neutral` / `gray` ramp is the dark violet/indigo ramp: `700` is the
card/sidebar/header surface (`#2b254c`), `800` the page (`#19152e`), `900`
raised chrome (`#120f1e`), `black` the terminal (`#0a0812`), and the upper
steps are the violet-tinted text greys (`#edeaf8` down to `#8680a2`). The
stock panel builds every surface from `neutral-700/800/900`, so the whole
panel lands on the palette without per-page overrides. Corners are square
everywhere: a global radius reset also neutralises the stock panel's rounding.

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
| `public/themes/pterodactyl/css/pterodactyl-theme.css` | create â€” violet/indigo tokens + shell/auth/dashboard/console/files styles |
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
| `components/elements/Spinner.tsx` | replace - round, small loading ring (see *Loading spinner* below) |
| `components/server/console/{ServerConsoleContainer,PowerButtons,Console,StatBlock,StatGraphs,chart.ts,style.module.css}` | replace |
| `components/server/files/{FileManagerContainer,FileManagerBreadcrumbs,FileObjectRow,MassActionsBar,style.module.css}` | replace |

**Infrastructure carried over from the token work**

| File | Action |
| --- | --- |
| `app/Http/Controllers/Admin/SiteSettingsController.php` | create - site name, icon (file or link), both background slots + scrim intensity, the three quick links |
| `resources/views/admin/site-settings.blade.php` | create - Site Settings page: server-rendered General & Links tabs, per-block Save, live previews |
| `app/Http/Controllers/Admin/RegistrationController.php` | create - enable/disable public sign-up |
| `resources/views/admin/registration.blade.php` | create - Admin -> Registration page |
| `app/Http/Controllers/Auth/RegisterController.php` | create - `POST /auth/register` creates the user via the panel's `UserCreationService` |
| `app/Http/ViewComposers/AssetComposer.php` | replace - exposes `SiteConfiguration.logo` / `.registration` / `.backgrounds` |
| `routes/auth.php` | replace - stock routes + `GET/POST /auth/register`, no recaptcha middleware |
| `routes/admin.php` | replace - stock routes + `/admin/site-settings` + `/admin/registration` |
| `resources/views/layouts/admin.blade.php` | replace - Site Settings + Registration menu items, icon favicon |
| `resources/scripts/lib/brand.ts` | create - `brandName()`/`logoUrl()`/`registrationEnabled()`/`backgroundStyle()`/`linkHref()` from `SiteConfiguration` |
| `resources/scripts/lib/theme.ts` | create â€” `ptColor` (Chart.js helper; dark-only, no theme state) |

Server-side rendering, permissions, API routes and the database are unaffected.

## Customising

- **Icon / logo** - Admin -> **Site Settings** -> *Name & icon* takes an uploaded
  file *or* a pasted `https://` link. Uploads land in
  `public/themes/pterodactyl/images/custom-logo.<ext>`; a pasted link is stored as
  `Brine::icon_url`, wins over a stored upload and deletes it. The login emblem,
  the sidebar icon and the favicon (user panel + admin) all come from whichever one
  is set, validated again on every render; tick "remove" to fall back to the theme
  emblem. The stock `public/favicons` folder is moved into the backup on install
  and restored on uninstall.
- **Site name** - set it in the same *Name & icon* block. It is stored as the panel's
  own name (`settings::app:name`), so the sidebar, topbar, login card, footer and
  page title all pick it up through `brandName()` without anything hardcoded.
- **Backgrounds and scrim** - Admin -> **Site Settings** -> *Login & register
  background* / *Dashboard background* each take an uploaded file *or* a pasted
  `https://` link ending in `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` or `.svg`.
  Uploads land in `public/themes/pterodactyl/backgrounds/bg-<area>.<ext>`; a
  pasted link wins over a stored upload and deletes it. Anything else - a `data:`
  URI, a relative path, a non-image link - is rejected on save and ignored on
  render. The two areas are saved through separate endpoints, so a change to one
  never touches the other.
  The scrim is **black only** - the colour picker was removed in 1.7.0 because a
  light scrim over a light photo makes the dark text unreadable. What is left is
  an intensity (0-100%) per area, stored as `Brine::bg_<area>_overlay_intensity`
  and shipped to the client as `--pt-bg-overlay-strength{,-auth}`, with the colour
  triplet pinned to `0 0 0`. Any colour row left over from an older install is
  cleared the next time that area is saved.
- **Quick links** - Admin -> **Site Settings** -> *Links*. Each of Home, Discord
  and Status is a URL plus an on/off switch, stored as
  `Brine::link_<slot>_enabled` / `_url`; a disabled link is omitted from
  `SiteConfiguration.links` so the button disappears rather than just going dead.
  Targets are validated **twice** - on save and again in `AssetComposer` - to
  `https://` addresses and single-slash paths, because these become `href`s and a
  `javascript:` value would be a stored XSS against every visitor. Protocol
  relative `//host` targets are rejected as well. Home may be left empty, in
  which case it points at `/`.
- **Registration** - Admin -> **Registration** to turn public sign-up on or off.
  Accounts are created directly by the panel's own user service, so there is no
  API key to manage; the setting lives in panel settings
  (`Brine::registration_enabled`).
- **Colours** â€” edit the token blocks at the top of
  `public/themes/pterodactyl/css/pterodactyl-theme.css`. Channel triplets are
  `R G B` separated by spaces (e.g. `--pt-gold-600: 200 164 78;`). Mirror the
  same edit into `tailwind.config.js` only if you add a *new* ramp.
- **Glass** - the frost strength is a token, not a per-surface value: tune
  `--pt-glass-blur`, `--pt-glass-tint`, `--pt-glass-border` and
  `--pt-glass-highlight` in the same `:root`, and the named gradients
  (`--pt-aurora`, `--pt-frost-hero`, `--pt-frost-console`, `--pt-frost-bloom`,
  `--pt-topbar-rule`) to recolour the whole frosted layer at once. Keep those
  gradients as named tokens rather than inlining them: `rgb(var(--pt-*) / a)`
  inside a gradient inside a media query is a construct Prettier 2.7 - the
  version this panel ships - cannot parse, even though postcss and every browser
  accept it.
- **Type** - edit `--pt-font-body` / `--pt-font-heading` in the stylesheet; the
  system stack ships with no `.woff2` files.
- **Loading spinner** - the theme ships its own `components/elements/Spinner.tsx`
  because the stock ring was broken twice over here:
  - *Square.* The stock ring is `border-radius: 50%` on a plain `div`, and this
    stylesheet resets corners with `* { border-radius: 0 !important; }` to keep
    its dense surfaces flat. The spinner was never added to the opt-back-in list,
    so the ring rendered as a square box on every page load. The override
    re-asserts `50%` with `!important`, and `.pt-spinner` is in the exception
    block so the reset stays the visible default.
  - *Oversized.* `size={'large'}` was hardcoded at every page-level call site
    (`ServerRouter`, `DashboardContainer`, `FileManagerContainer`), which is
    `w-16 h-16` with a 6px border and `m-20` of dead margin when centered. The
    override caps every step - small 14px, base 18px, large 22px - so a caller
    still asking for `large` gets a small ring, and the hardcoded `large` props
    are gone from the call sites.
  - The ring colour follows `--pt-gold-500`, the same accent as the rest of the
    theme, rather than the stock white. `isBlue` still works.

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

Checks run against a clean `pterodactyl/panel` v1.15.1 checkout (Tailwind 3.4.18,
webpack 5.105) with this package installed:

- `yarn build:production` succeeds with 0 errors. The built bundles resolve the
  brand ramp through `rgb(var(--pt-*))`, expand opacity modifiers
  (`bg-blue-500/75` -> `rgb(var(--pt-navy-500) / 0.75)`) and contain no literal
  `<alpha-value>`.
- The same `tailwind.config.js` also compiles under Tailwind 3.1.0, 3.0.24 and
  2.2.19 against a stylesheet exercising `@apply bg-blue-500/75 text-blue-200/75
  text-primary-500/50` plus hover/focus/disabled variants. 2.0.x cannot, its
  classic engine having no opacity modifiers at all.

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

