# brine-theme

  A full UI overhaul of **Pterodactyl Panel** (v1.12 – v1.15) with the **Aternos**
  control-panel layout and a monochrome black palette — `#0b0b0d` page,
  `#141417` surfaces, neutral `#c8ccd0` accent, the system UI font stack, a fixed
  sidebar shell and frosted glass surfaces over a cool aurora.

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
  gradient hairline, and a sliding mobile drawer with a hamburger burger. On a
  server page the sidebar lists the server's own pages only — the current
  server's name is not repeated there, because the topbar subtitle and the
  console hero both already name it and a third copy reads as a dead link.
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
  - **Site Settings** (`/admin/site-settings`) — three tabs, all server-rendered
    so they work with no JavaScript. **General** is a stack of independent blocks,
    each with its own **Save** button:
    - **Name & icon** — the site name, and the icon as an **uploaded file or
      pasted image link** (PNG, SVG, JPG, ICO, GIF, WEBP), with a live preview.
    - **Login & register background** — an on/off switch, an **uploaded file or
      pasted image link** (PNG, JPG, GIF, WEBP, SVG), an **intensity slider** for
      the scrim and a live preview, defaulting to 78%.
    - **Dashboard background** — the same controls, defaulting to 62%.

    Each background is saved through its own endpoint (`/background/{slot}`), so
    saving one can no longer switch the other one off. **Theme** picks the panel
    palette — see *Palette picker* below. **Links** sets up to three quick links
    — **Home**, **Discord**, **Status** — each with a URL and an on/off switch.
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
  | `navy` | `--pt-navy-*` (300 = `200 204 208` = `#c8ccd0`) | the light accent: links, icons, hairlines, filled buttons |
  | `gold` | `--pt-gold-*` (tracks `navy` step for step) | accent alias: rules, focus, active states |

  Both ramps are **neutral**. The step a value lands on is chosen by what the
  stock panel does with it, not by convention: `text-blue-*` / `text-primary-*`
  only ever reach for steps 50-500, while `bg-primary-600` is a *fill* step
  (it is what `server/console/StatBlock` paints its icon tile with). So the light
  accent sits at 300/400 and 600 is a muted dark fill — painting 600 light turns
  every one of those stock tiles into a near-white slab.

  A light fill cannot carry a pale label, so filled buttons take a near-black one
  (the modern dark-UI convention). That also repairs `amber`, whose gold accent
  is light: its button label measured **2.16:1** as white-on-gold and **7.58:1**
  with a near-black label.

  `blue` and `primary` are **aliased to the navy ramp** and `cyan` is **aliased
  to the gold ramp**, so every stock `text-blue-*`, `bg-primary-600`,
  `border-cyan-500` and navigation underline rebrands with no component edits.
  `red` / `green` / `yellow` keep their stock semantics for status and errors.

### Neutral ramp

  The `neutral` / `gray` ramp is the monochrome black ramp: `700` is the
  card/sidebar/header surface (`#141417`), `800` the page (`#0b0b0d`), `900`
  raised chrome (`#060608`), `black` the terminal (true black), and the upper
  steps are the neutral text greys (`#f5f5f7` down to `#7a7a82`). The
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

51 files. Full detail lives in `manifest.json`; the summary:

**Build & chrome**

| File | Action |
| --- | --- |
| `tailwind.config.js` | replace â€” brand ramps + `rgb(var(--pt-*))` emitters |
| `resources/views/templates/wrapper.blade.php` | replace - stylesheet link, plus `data-pt-theme` on `<html>` and a theme-color that follow the chosen palette (title and favicon stay stock) |
| `public/themes/pterodactyl/css/pterodactyl-theme.css` | create - monochrome tokens + shell/auth/dashboard/console/files styles |
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
| `components/auth/{LoginFormContainer,LoginContainer,LoginCheckpointContainer,ForgotPasswordContainer,ResetPasswordContainer}.tsx` | replace - `LoginFormContainer` is the split-screen shell (see *Auth layout* below) |
| `components/auth/RegisterContainer.tsx` | create - public sign-up form |
| `api/auth/register.ts` | create - CSRF + `POST /auth/register` |
| `routers/AuthenticationRouter.tsx` | replace |
| `components/elements/{PageContentBlock.tsx,button/style.module.css}` | replace |
| `components/elements/Spinner.tsx` | replace - round, small loading ring (see *Loading spinner* below) |
| `components/elements/DropdownMenu.tsx` | replace - viewport-clamped `position: fixed` panel (see *File actions menu* below) |
| `components/elements/Field.tsx` | replace - adds an optional `labelAction` on the label row |
| `components/server/console/{ServerConsoleContainer,PowerButtons,Console,StatBlock,StatGraphs,chart.ts,style.module.css}` | replace |
| `components/server/files/{FileManagerContainer,FileManagerBreadcrumbs,FileObjectRow,FileDropdownMenu,MassActionsBar,style.module.css}` | replace |

**Infrastructure carried over from the token work**

| File | Action |
| --- | --- |
| `app/Http/Controllers/Admin/SiteSettingsController.php` | create - site name, icon (file or link), both background slots + scrim intensity, the palette picker, the three quick links |
| `resources/views/admin/site-settings.blade.php` | create - Site Settings page: server-rendered General / Theme / Links tabs, per-block Save, live previews |
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

## Plugins and Mods

A jar installer at **Server -> Plugins** (Bukkit-family) and **Server -> Mods**
(mod-loader). Both are the same component, parameterised by flavour: install a jar
into `plugins/` or `mods/`, list what is installed, remove it. Theme-only:
**no new panel route, no new permission, no backend of ours.**

| File | Action |
| --- | --- |
| `components/server/jars/JarsContainer.tsx` | create - the page, for both flavours |
| `components/server/jars/style.module.css` | create - page styling on the theme tokens |
| `api/server/jars.ts` | create - Modrinth catalog + the panel file calls, per flavour |
| `lib/serverFamily.ts` | create - which flavours a server can take |
| `lib/serverExtras.ts` | create - the two routes, shared by router/sidebar/topbar |

**What each server gets.**

| Server | Nav |
| --- | --- |
| Paper / Spigot / Purpur (`plugins/`) | Plugins |
| Forge / Fabric / Quilt / NeoForge (`mods/`) | Mods |
| Both directories present | both items |
| Vanilla, Source Engine, TeamSpeak, Rust | neither |

**How that is decided.** The panel does not expose the egg *name* to the client:
`ServerController::index` never calls `parseIncludes()`, so `?include=egg` is
silently ignored, and `egg_features` is identical across the Minecraft eggs
(`["eula","java_version","pid_limit"]` on every one of them). `docker_image` is
the shared java image.

What *is* available is the egg's variables, and they are a reliable fingerprint:
`EggVariableTransformer` **throws** on anything not `user_viewable`, so only the
variables an admin chose to expose reach the browser. Their *names* differ per
family even where every value is `latest` - `FORGE_VERSION` and `BUILD_TYPE` for
Forge, `MINECRAFT_VERSION` and `BUILD_NUMBER` for Paper, `VANILLA_VERSION` for
Vanilla, `SRCDS_APPID` for Source Engine, `TS_VERSION` for TeamSpeak.

So detection is two steps: the variable names rule out families outright (a
TeamSpeak or Rust server costs zero requests), and the filesystem settles the
rest. A Fabric egg that reuses `MINECRAFT_VERSION` is indistinguishable from
Paper by name alone, so the sidebar probes `plugins/` and `mods/` in parallel
and lets the directories decide. Probing is what makes it robust to a hybrid
server and to a custom egg.

**How an install actually happens.** The panel already exposes
`POST /api/client/servers/{uuid}/files/pull`, which hands a URL to the *daemon*.
The jar therefore never passes through the browser - no CORS, no memory ceiling,
no size limit - and the endpoint only requires `Permission::ACTION_FILE_CREATE`,
which every user already has. Nothing is proxied through PHP.

**Why Modrinth only.** `api.modrinth.com` sends `access-control-allow-origin: *`,
so the browser can query it directly - ~17k Paper plugins and ~46k Fabric mods,
both filtered by `project_type`. Spigot and Hangar do not send CORS, and
supporting them would mean the panel fetching arbitrary URLs on the user's behalf
- an SSRF surface that would need allowlisting.

**Permissions.** `file.read` to open the page, `file.create` to install,
`file.delete` to remove. A read-only subuser can see what is installed but sees
no install or remove controls.

**Browse, search and paging.**

- **Browse** opens on the most-downloaded entries rather than an empty prompt.
  That is an *empty* Modrinth query with `sort=downloads` - the same request the
  search box makes, minus the query. An empty query was previously rejected here
  as noise, which is right for a search box and wrong for a default listing.
- **Search is live**, debounced 300 ms, so results update as you type instead of
  on submit. Out-of-order responses are dropped, which a per-keystroke search
  makes routine: a slow request for `ess` must not overwrite `essentials`.
- **20 results per page** with Previous/Next and a page counter, from Modrinth's
  `limit`/`offset`. The page resets on the keystroke rather than after the
  debounce, so changing the query never briefly shows page 3 of the new results.

**Minecraft version matching.** The page reads the version from the server's egg
variables - `MINECRAFT_VERSION` on Bukkit, `MC_VERSION` on Forge, both
`user_viewable` and so already in the client payload with no daemon round trip.
It then filters the catalog through Modrinth's `versions:` facet and restricts
the version picker to builds whose own `game_versions` array contains it,
defaulting to the newest compatible one. Install therefore picks a build that
matches the server rather than the newest build overall.

Two details worth knowing:

- The filter is **re-applied client-side** on the way back from Modrinth. A
  build's `game_versions` array is the authority on what it supports, and
  trusting the server-side filter alone has been observed to return a build whose
  array does not contain the version asked for.
- The egg default is the literal string `latest`, a sentinel rather than a
  version. That is reported as **unknown** and no filter is applied, with the
  reason shown and an input to set one by hand. Guessing would silently hide
  compatible add-ons, which is worse than showing all of them. A project with no
  build for the selected version says so and offers to show every version rather
  than presenting an empty picker.

**Also worth knowing.** A version that declares `required` dependencies shows a
warning before install, because installing it without them fails silently at
server start. Modrinth versions can carry more than one file (signatures and
metadata alongside the jar) and `file_type` is not populated consistently, so the
installer selects on `primary` and re-checks the extension is `.jar`.

## Software switching (admin)

**Admin -> Servers -> View -> Software** changes which software a server runs.
This is the only part of the theme in the admin area, and it is there because
that is the only safe place for it.

**Why admin-only.** Stock Pterodactyl restricts egg changes to root admins, and
for good reason: the files on disk belong to the *old* software. Paper's
`plugins/` and world format mean nothing to Fabric, so switching normally forces
a reinstall that wipes the server. A user-facing switcher would be a privilege
escalation with a data-destruction button attached. The theme is otherwise a user
panel only.

It is not gated by a check of our own. The routes live in `routes/admin.php`,
which the panel loads inside `['auth.session', 2FA, AdminAuthenticate]`, and
`AdminAuthenticate` throws unless `root_admin` is set.

**This panel has no egg switching at all**, so it is written from scratch rather
than re-enabled: `updateBuild` accepts only allocations and limits,
`BuildModificationService` handles no `egg_id` or `image`, and the admin build
view never mentions an egg.

| File | Action |
| --- | --- |
| `app/Services/ServerSoftwareService.php` | create - the switch |
| `app/Http/Controllers/Admin/Servers/ServerSoftwareController.php` | create - the page |
| `resources/views/admin/servers/view/software.blade.php` | create - the view |
| `resources/views/admin/servers/partials/navigation.blade.php` | create - adds the Software tab |

**What the switch does**, none of which the panel's own service does any more:

- sets `servers.egg_id` and `servers.image`
- sets `servers.startup` from the target egg, **but only when the current startup
  is still the old egg's default** - a customised command is the admin's own and
  is left alone
- rebuilds `server_variables` from the target egg, carrying each value across
  wherever the same `env_variable` exists on both eggs, so `SERVER_JARFILE` and
  the Minecraft version survive
- syncs the daemon, and reinstalls when the change crosses families

**Two schema differences from stock Pterodactyl**, both of which would fail
silently:

- the column is `eggs.startup`, not `eggs.start`
- there is no `eggs.docker_image`. This is a Blueprint panel and the column is
  `eggs.docker_images`, a JSON map of `{label: image}` offering several Java
  versions per egg. The switch picks the entry matching the Java the server is
  already on, so a Paper -> Spigot change does not silently reset Java 21 to
  whatever is listed first.

**Safety rules.**

| Case | Behaviour |
| --- | --- |
| Same family (Paper/Spigot/Purpur/Bukkit, or Forge/Fabric/Quilt/NeoForge, or proxy to proxy) | no reinstall, files kept |
| Cross family, or anything involving a non-Minecraft egg | reinstall, and only with the confirmation ticked |
| Server running | refused |
| Daemon unreachable | refused - it cannot confirm the server is stopped |
| Server installing, or skipping egg scripts | refused |

The page splits same-family and cross-family targets into two columns so it is
obvious which is which before submitting, and it works with JavaScript disabled:
the confirmation is enforced server-side, and the script only adds a live summary
and the enable/disable.

The running check reads the power state from the **daemon**, not the database -
`servers.status` records `installing` and `suspended` but never `running`, so a
database check would happily switch a live server.

**Eggs are whatever the panel has.** The picker reads the panel's own egg table
grouped by nest, with no hardcoded list, so imported eggs appear automatically.
Stock Pterodactyl does not ship Spigot, Velocity, Fabric or Purpur: to get those,
import them once through **Admin -> Nests -> Import egg** and they will show up
here.

**One trap worth knowing.** `Server::with('variables')` hydrates the aliased
`server_value` as `NULL` while the lazy path returns it, so an eager-loaded read
makes every per-server override look unset. The generated SQL is identical either
way. The panel reads lazily and is unaffected; anything that eager-loads that
relation will see the wrong thing.

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
- **Upload size limits** - the page never advertises a size the server cannot take.
  It reads `upload_max_filesize` and `post_max_size` and shows the lower of those
  and the theme's own cap, so a stock PHP install (2M/8M) says 1984 KB rather than
  the theme's 4096 KB. This matters because PHP discards an oversized upload
  *silently* - no exception, no validation error, the field just arrives empty -
  which used to land in the "no file was chosen" branch and flash a green
  "Site name saved." while the icon went nowhere. A discarded upload is now
  reported with the reason from `$_FILES` and the real limit, and a body that blew
  `post_max_size` (which empties `$_POST` as well, so every field vanished) is
  called out instead of failing validation on the site name. Raise the limits in
  php.ini and reload PHP if you want bigger files.
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

  **With no photo set, no scrim is painted at all** - the stylesheet default for
  both strengths is `0`. `backgroundStyle()` writes the real triplet and strength
  inline whenever a slot actually has an image, so the default is only ever
  reached in the no-photo case, where a 62%/78% black wash does nothing but crush
  the palette into a flat near-black slab and hide the aurora. The intensity
  slider is unaffected: it travels through the inline value, not the default.

  What carries the page instead is `--pt-page-depth`, painted on `.pt-shell`
  itself: a soft lift under the topbar so the chrome separates from the content,
  plus a barely-there 4rem grid so large empty areas have some texture. It sits
  *below* the photo layer (`.pt-shell::after`, z-index 0, over the container's
  own background), so a configured photo covers it completely and nothing has to
  test whether a photo exists.
- **Palette picker** - Admin -> **Site Settings** -> **Theme** recolours the
  whole user panel. Two palettes ship, both dark:

  | Slug | Look | Page / surface / accent |
  | --- | --- | --- |
    | `black` | the default: monochrome, frosted glass | `#0b0b0d` / `#141417` / `#c8ccd0` |
  | `amber` | flat black + amber, rounded | `#0c0c0c` / `#1c1c1c` / `#d9a441` |

  There is **no `default` slug**. The black palette is the `:root` block in
  `pterodactyl-theme.css`, so a panel with nothing stored renders it directly
  and no variant selector is needed for it. `black` is still a real, selectable
  slug - it is a name an admin can pick, and both `themeVariant()` methods fall
  back to it for a stale stored value, including one left by the retired
  `default` slug. Saving `black` clears the settings row rather than writing it,
  so resetting to the default behaves exactly like a fresh install.

  ### The `amber` palette - flat, monochrome gold, rounded

  `amber` is the odd one out. `default` and `black` are the same design in
  different colours, frosted glass included; `amber` changes the *material*.
  It comes from a game-hosting login screen - a near-black landing page with a
  single warm gold doing all the work: gold heading, gold links, one solid gold
  Log in button, and nothing else coloured at all. There are **no gradients, no
  glow and no frosted blur**; borders and solid fills do the work.

  It takes two halves, and both are needed:

  - **The token block** near the top of the stylesheet re-points the ramps.
    There is no second hue here - the reference is monochrome-gold - so the
    *blue* ramp is pointed at the same `#d9a441` as the `cyan` ramp, and
    `bg-primary-600` and `text-blue-*` come out amber too, which is what the
    reference shows. The gold ramp stops being an alias of navy (it is one
    everywhere else) and becomes a real gold scale, so the brand rule, the
    `cyan` alias and the active-nav marker all turn gold. That lines up with
    this file's existing `blue`/`primary` -> navy and `cyan` -> gold aliases, so
    `tailwind.config.js` needs no change. Every decorative token goes to `none`:
    `--pt-aurora`, `--pt-page-depth`, `--pt-frost-*`, `--pt-topbar-rule`. The
    glass recipe is flattened - blur `0px`, saturate `100%`, tint and top
    highlight `0`, hairline borders, a `0 1px 2px` shadow.
  - **The flat-mode rule block** further down finishes the job, at
    `[data-pt-theme='amber'] .pt-*` - (0,2,0) against the glass layer's (0,1,0),
    so it wins on specificity alone and does not depend on source order. Tokens
    alone cannot do it: the glass layer bakes its translucency in as literal
    alphas (`rgb(var(--pt-navy-900) / 0.62)` and a dozen others), and four
    coloured `box-shadow` blooms are written inline.

  **If you edit this palette, edit both halves.** Changing a token without
  touching the rule block leaves a 62%-transparent sidebar and a glowing Start
  button; changing a rule without the token leaves violet aurora behind.

  The auth **focus ring** is deliberately left in place. It looks like one of the
  blooms and is not - removing it would cost keyboard users their only focus cue.

  `navy-800/900` are the one part of the blue ramp that stays neutral black:
  those are surfaces, not accents, so they must not pick up the hue.

  **Corners are rounded here**, where the other two palettes are square - 12px
  card, 8px fields, pill submit button. The glass radius tokens cover the
  surfaces this file styles itself, but the panel's form controls are Tailwind
  components it never touches, so a short extra block ("amber rounding") puts
  the rounding back on them. That block needs `!important`, because the
  `* { border-radius: 0 !important }` reset is itself `!important` at (0,0,0).

  Card-on-page separation is deliberately low (1.20:1). The reference is in the
  same place - 1.11:1 for a white card on `#0e0e0e` - and the 1px border does
  the separating. The amber is not a tint: `#d9a441` measures 8.60:1 on the page,
  7.16:1 on a card and 7.58:1 on the sidebar.



  Switching one is instant on the next click, with **no rebuild, no asset
  flush and no cache clear** - the palettes are `[data-pt-theme='<slug>']`
  blocks in `pterodactyl-theme.css` that re-point the same `--pt-*` tokens, and
  the wrapper renders the slug onto `<html>`. That works because
  `tailwind.config.js` emits every colour utility as `rgb(var(--pt-*))`, so the
  stock panel's own `bg-neutral-800` / `text-neutral-300` / `border-cyan-500`
  re-skin themselves with no component edits. The compiled bundle carries no
  baked-in brand hex to disagree (verified: 288 `var(--pt-` references, and no
  literal in any declaration carries a hue).

  One trap on Tailwind **below 3.1**: those engines cannot compute an alpha
  channel for a colour they cannot parse, so the config bakes `PALETTE` in as
  literal hex instead. That copy mirrors the **default** palette only, and nothing
  enforces the link - a stale one is invisible in dev, because from 3.1 up the
  variables win and the literals are dead. A violet `PALETTE` left behind after
  the palette moved to black is exactly that failure: dev looks right while every
  panel on 3.0.x renders the old colours. Below 3.1 the values are baked, so
  `data-pt-theme='amber'` cannot re-skin *stock* utilities there either; the
  theme's own classes still respond, because they read the variables directly.

  Three details worth knowing before editing a palette:
  - **Source order decides, not specificity.** `:root` and `[data-pt-theme='x']`
    are both (0,1,0), so the variant blocks must stay *below* `:root` in the
    stylesheet. Moving them above silently reverts every panel to the default.
  - **A variant must re-point the whole ramp, not just the grey one.** The
    sidebar, topbar, brand block, drawer and sidebar footer all paint from
    `navy-800` / `navy-900`, not from `gray-*` - those two steps are the *surface*
    end of the primary ramp. `black` originally overrode only `gray-*` and left
    them, so its entire left-hand chrome stayed violet (`#231e40` / `#19152e`)
    while the rest of the panel went black. The rule of thumb: `navy-500..700`
    are the interactive steps (blue in every palette, on purpose, so links and
    focus rings keep reading as interactive), and `navy-800/900` are surfaces and
    **must** follow the palette.
  - **The scrim is black on every palette**, and `--pt-black` / `--pt-white` are
    left alone on all of them - those two are only consumed by the console, and
    a terminal stays dark whichever palette is active.

  There is deliberately no light palette. The panel paints `text-neutral-500`
  23 times and `bg-neutral-500` 9 times, so that single step has to work as both
  legible copy and a visible fill. Inverting the ramp is possible, but it forces
  `gray-500` to be solved against the **darkest** surface it can land on
  (`gray-900`) instead of the card - a card-only check passes values that are
  unreadable on raised chrome - and the frost recipe has to invert with it
  (white tints are what make glass visible; on a light page they vanish). That
  is a second theme, not a variant, so it is not offered here.

  The slug is validated against a whitelist in `AssetComposer` and again in the
  controller, so a hand-edited settings row cannot inject markup into the
  `<html>` attribute. Adding a palette means adding a CSS block and one row in
  `SiteSettingsController::THEMES`; nothing else changes. Dropping a row is the
  whole removal - the admin cards, the validation rule and
  `AssetComposer::THEME_VARIANTS` all read from it, and a stale stored slug
  falls back to `default`.
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
- **Auth layout (split screen)** - every auth screen (login, register, forgot,
  reset, 2FA) is a 50/50 split, matching the design the theme was built to.
  `LoginFormContainer` is the shared shell:
  - `.pt-auth-hero` (left) carries the admin's **Login & register** background
    image. That layer used to be a `position: fixed` `::after` on the whole page;
    it now belongs to the hero half only, because a full-bleed photo across a
    split screen puts artwork behind the form. The scrim is a two-stop vertical
    gradient rather than a flat fill, because the marketing line sits at the
    **foot** of the hero - the bottom has to be dark for the text while the top
    stays open for the artwork. Upload your illustration through
    **Site Settings → Login & register background**; it is positioned and scaled
    to fill the hero.
  - `.pt-auth-panel` (right) owns the vertical rule, the centring and the page
    padding, so the hero can bleed to the viewport edge untouched. The brand
    lockup (mark + site name) sits above the card. The mark's backing is a dim
    surface rather than the old white chip - a white box read as a sticker on a
    black screen, and it forced light-on-dark - but a backing is kept at all so
    a dark uploaded icon still separates from the panel.
  - The card carries a header band (a shade lighter, hairline under it) with the
    title and subtitle, then the body, then the footer. Register / Forgot /
    Reset / Checkpoint pass their own title and subtitle, so every screen gets
    the layout without extra work.
  - The gold full-width submit, the rounded fields and the gold focus ring are
    on **both** palettes. The amber-only `999px` pill override was removed: a pill
    on a 44px button reads as a toggle, not a call to action.
  - `components/elements/Field.tsx` gains an optional `labelAction` so
    "Forgot password?" can sit on the **Password label row** rather than in a
    block below the field. The stock component puts the label on its own line
    with the input after it, so this cannot be done from the stylesheet - the
    link is not a sibling of the label. It is additive: with no `labelAction`
    the markup is byte-for-byte stock, so the other ~200 `Field` call sites in
    the panel are untouched.
  - Below 1024px the hero collapses away entirely and the panel takes the full
    width. `.pt-auth` needs `min-width: 0` for this: a flex item defaults to
    `min-width: auto` and refuses to shrink below its content, so without it the
    card's max-width plus the panel padding pushed the page sideways on a phone.
    The responsive overrides are declared **after** every base rule on purpose -
    a media query adds no specificity, so one declared first is simply
    overwritten by the base rule below it.
  - reCAPTCHA stays disabled (see *reCAPTCHA* below), so no widget renders. The
    field label stays **Username or Email** rather than the reference's "Email
    address", because the login endpoint accepts either and a narrower label
    would be wrong for anyone signing in with their username.
- **File actions menu** - the theme ships its own `components/elements/DropdownMenu.tsx` because the three-dot button on a file row did nothing at all, for two reasons that compounded:
  - The stock panel rendered the panel `position: absolute` inside a plain
    wrapper and nudged it with `left = viewportX - width`. That arithmetic is
    only correct when the wrapper happens to sit at the viewport origin; inside
    a `.file_row` at some page gutter it placed the panel `left` px too far
    right.
  - `.file_row` also set `overflow: hidden`, so the panel was clipped by the row
    that contained it. The row has a square corner radius, so nothing needed
    clipping - `.details` already truncates its own text - and the clipping is
    gone.
  - The panel is now `position: fixed`, so the click coordinates line up, with
    the vertical placement taken from the toggle's own rect and clamped to the
    viewport, flipping above the toggle when it would fall off the bottom. It
    repositions on scroll and resize, and closes on outside click or
    right-click. `components/server/files/FileDropdownMenu.tsx` is overridden to
    match: the stock rows hovered to `bg-neutral-100` on `text-neutral-700`,
    which on the black palette is a near-white bar with near-black text cutting
    across a dark menu.
- **Mobile console** - the console used to be full-bleed on phones via
  `margin-left: -1rem` with `width: calc(100% + 2rem)`. Because `.terminal`
  clips its overflow, xterm's `FitAddon` measured a box 2rem wider than anything
  the user could actually see and laid each line out to fit it, so the right-hand
  end was always cut off. The width now always matches the visible area and the
  edge-to-edge look comes from zeroing the container's own padding on phones,
  which does not lie to the measurer. `Console.tsx` also watches its host with a
  `ResizeObserver`, because the box changes width without a window resize when
  the mobile drawer opens or the browser's URL bar collapses - without it the
  terminal kept the column count it was fitted with.
- **Focus rings** - the stylesheet owns the outline for every theme control:
  `outline: none` on `:focus` so a tap does not leave the browser's default ring
  (the hard outline around the burger in the mobile screenshots), and a
  `--pt-gold-400` ring on `:focus-visible` so keyboard focus is still visible.
  The per-component rules had it exactly backwards - they removed the outline on
  `:focus-visible`, taking the ring away from keyboard users, and left plain
  `:focus` alone, which is the state a tap produces.

## Known limitations

- **The icon/background upload needs a writable `public/themes/pterodactyl`.**
  The installer runs under `sudo` and copies with `cp -a`, which preserves
  ownership, so the payload used to land as `root:root` - including
  `images/`, which the manifest ships (`logo.svg`). `www-data` could then not
  write the uploaded icon and Site Settings refused the save with *"the folder
  is not writable by PHP"*, however the admin set the permissions in the
  browser. The installer now detects the user PHP runs as (the owner of
  `storage/`, then `public/assets`, then the usual suspects) and hands
  `public/themes/pterodactyl` plus `images/` and `backgrounds/` to it at 775.
  If you installed with a build from before that, fix it once:
  ```sh
  chown -R www-data:www-data /var/www/pterodactyl/public/themes/pterodactyl
  chmod 775 /var/www/pterodactyl/public/themes/pterodactyl/{images,backgrounds}
  ```
  Substitute your own PHP user if it is not `www-data`. `backgrounds/` is not
  in the manifest - the controller creates it on first use - so the installer
  creates it too, rather than leaving the same trap one directory over.
- Syntax highlighting in the file editor still uses stock hex literals, so those
  few colours do not follow the theme.
- Chart dataset colours (cyan/yellow) are captured when a chart is created.
  They match the dark palette, so this is not visible in practice.
- The neutral ramp splits at 500/600: `50`-`500` are **text** steps and `600`-`900`
  are **surface** steps, so there is a deliberate cliff between 500 and 600 rather
  than a missing step. The stock panel uses `text-neutral-500` for all of its
  small muted text (22 call sites - the auth "Forgot password?" link, pagination
  footers, the meta line on every subuser/database/schedule/backup row) but
  `bg-neutral-600` as a row fill (12 call sites) and `border-neutral-600` as a
  divider (5). Those two roles want opposite colours, so `500` is a readable
  grey and `600` stays dark. Measured on the black palette: `neutral-500` is
  **4.69:1** on a card and **5.01:1** on the page; on amber, 4.62:1 and 5.55:1.
  It used to be `38 38 42` - a surface value - which put that text at 1.22:1,
  effectively invisible.
- `tailwind.config.js` carries a literal copy of the ramp for the pre-3.1
  fallback path, and the two have to stay in step; the tokens in the stylesheet
  are what a Tailwind 3.1+ build actually emits. Both blocks carry a comment
  saying so.
- The stylesheet is cache-busted on its own `mtime`, not on the theme version.
  It used to be `config('app.version')`, which is the *panel's* version and so
  never changes on a theme update - with the `max-age=14400` the web server
  sends for static files, a theme update left browsers on the previous
  stylesheet for up to four hours with no revalidation. That is how the login
  page kept rendering a blue submit button after the palette underneath it had
  already changed.
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

