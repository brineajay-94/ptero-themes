# brine-theme

  A full UI overhaul of **Pterodactyl Panel** (v1.12 – v1.15) following the
  **Aternos** reference: a **light** palette — `#f2f4f6` page, `#ffffff` cards,
  dark ink, a `#2977cb` blue accent — with two **dark chrome islands** floating on
  it (a slate topbar and slate server cards), the system UI font stack and a
  topbar-only shell.

What it changes on top of the stock panel:

- **Light palette, dark chrome islands.** The page is near-white and the cards on
  it are white, which is the reference's arrangement. The topbar, the server cards
  and the console header are slate `#2d3748` with light ink — the page's ink steps
  are dark and unreadable there, so each island carries its own. The neutral ramp
  keeps its **roles** across the polarity flip (`50`–`500` ink, `600`–`900`
  surfaces), which is what lets the stock panel's ~200 colour utilities re-skin
  with no component edits. Every pairing is measured: stock muted ink clears
  4.5:1 on both the page and a card, and the blue fill clears 4.57:1 with white
  text.
- **Glass** — the topbar and mobile drawer are genuinely
  frosted (`backdrop-filter: blur + saturate`). Cards and the console header use
  the same material vocabulary — hairline border, top inner highlight, tinted fill —
  but deliberately **without** a blur: one
  `backdrop-filter` per row of a scrolling server list is the single most
  expensive thing you can put on a panel. Corners are rounded again on the
  frosted surfaces only; dense, unstyled areas stay square.
  The **auth screens are excluded entirely** — the form sits directly on the dark
  page, so there is nothing behind a panel for a blur to sample, and the light
  input fills are the contrast anchor for the form.
  The recipe is retuned for light, where a white tint on a white card would be
  nothing at all.
  Users who ask for less transparency (`prefers-reduced-transparency`) or run
  Windows high contrast (`forced-colors`) get opaque surfaces automatically.
- **Shell** — topbar-only, as in the reference: brand lockup and a quiet page
  title on the left, the admin's Home/Discord/Status links centred, and
  icon-over-label **Servers** and **Account** navigation with the username, a
  logout button and a round avatar on the right. There is **no desktop sidebar**;
  what it used to carry moved into the topbar. A sliding mobile drawer with a
  burger is unchanged and still renders the full navigation list, so removing the
  desktop sidebar was a layout change and not a loss of navigation.
- **Dashboard** — a centred blue **Servers** title, a row with the admin-only
  show-all-servers switch and a **Create** button, then a two-column grid of dark
  server cards carrying a pink accent bar, the name, the uuid, the egg and a round
  power button (pink to stop, blue to start).
- **Auth chrome** — every auth screen is framed by two bars. A **top bar** carries
  the brand lockup on the left and a `Home / {screen}` breadcrumb on the right,
  where the current screen takes the accent colour and an underline; the **bottom
  bar** carries a credit line on the left (`Designed by BrineAjay`) and
  `Home` / `Login` on the right. The form centres in the space between them.
- **Login** — a flat column on a **dark** page, matching the reference's
  arrangement rather than the dashboard's light one: the emblem centred above a
  "Welcome to {brand}" heading, a full-width sign-up button, an "or" rule, then
  one small "Login" label above a **single row** holding username, password and
  the submit button side by side, with "Forgot password?" underneath. Inputs are
  dark wells with light ink; the row stacks below 700px.
  There is **no card** — the reference has no panel behind the form. Checkpoint,
  forgot and reset follow the same flat treatment.
- **Auth accent** — the heading accent, the current breadcrumb and the
  required-field asterisks use `--pt-auth-accent`, a light blue declared on
  `.pt-auth-page`. They deliberately do **not** use `--pt-blue-400`, which is a
  dark blue chosen for the dashboard's white cards and measures only 2.01:1 on
  this page.
- **Registration** — a public sign-up page (`/auth/register`) with email, first
  and last name, username, password and confirm-password, per the reference:
  heading split so "your account" takes the accent colour, a leading glyph and a
  placeholder on every field, a blue asterisk on every label (all six really are
  required), and first/last name sharing a row. It appears behind the login
  page's sign-up button only when the admin enables it; accounts are created
  directly by the panel's own user service (hashed password, welcome e-mail,
  activity log) — no API key.
- **Social login** — sign in with **Google** or **Discord**, configured in
  Admin → **Social Login**. The panel had no social login at all before this, and
  the row of buttons in the reference was deliberately left out because "a dead
  Google button is worse than none" — so this is new capability rather than a
  re-skin, and the buttons only appear once a provider is fully configured.

  It is written directly against each provider's OAuth2 authorization-code flow
  using Laravel's built-in HTTP client. **No `laravel/socialite`, no
  `composer.json` change, nothing for the admin to run** — the panel does not
  ship Socialite, and a theme installable only by mutating the host's dependency
  tree breaks on the next panel upgrade.

  Getting it working takes three steps per provider: create an application in the
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials) or the
  [Discord Developer Portal](https://discord.com/developers/applications), paste
  the client id and secret into Admin → Social Login, and register the callback
  URL the page shows. A callback URL that does not match exactly is the most
  common reason a provider refuses a sign-in, which is why the page displays it
  with a copy button rather than only documenting it.

  **How a sign-in is matched.** The provider's address must be *verified* by the
  provider, and it is matched against existing users by email — a match signs
  straight in, with no password. An address with no account is created as a new
  user, but **only while Admin → Registration is on**: a panel that has turned
  registration off to stop sign-up spam has not decided social sign-up is exempt.
  With registration off, social sign-in still works for people who already have
  an account; it just will not create new ones.

  **The security decisions**, in the order they matter:

  - A per-attempt random `state` is parked in the session, compared with
    `hash_equals` and **pulled**, so a callback URL cannot be replayed and an
    attacker cannot feed a victim a code of their own to log them in as the
    attacker. The session id is also regenerated before login, because the browser
    carries one pre-auth cookie through the whole round trip.
  - The provider name is checked against a hardcoded whitelist before any URL is
    built, so there is no SSRF surface.
  - `email_verified` (Google) and `verified` (Discord) are **required**, not
    preferred — matching on a verified address is the entire basis for deciding
    whose account gets opened.
  - The **client secret is encrypted with the panel's `APP_KEY`** on the way into
    the settings table. It is a live credential for the admin's own application
    and the settings table is plain text, so anyone with database read access — a
    backup, a replica — could otherwise mint tokens as this panel. It is never
    rendered back into the form: a blank field means "keep the current one", and
    erasing it needs the explicit remove link.
  - **Accounts with 2FA are refused**, not signed in. The panel's checkpoint needs
    a confirmation token that only the stock password path mints, and quietly
    bypassing it would turn social sign-in into a way around a factor the user
    deliberately enabled. They are sent to the password form with an explanation.
  - **A successful sign-in records the provider in the session.** That is session
    state and not account state on purpose — an account can be signed in with a
    password in one tab and with Google in another, and only the session knows
    which is which. What reads it is [Change email](#what-it-changes-on-top-of-the-stock-panel)
    below, which will not touch the address from a provider session. It is not the
    enforcement by itself: "remember me" reopens a session from its cookie with a
    fresh session store, so the marker can be absent on a social user. That is fine,
    because an account created through a provider holds a 48-character random
    password nobody was ever given, and the password check refuses it anyway. The
    marker is what lets the page say *why* instead of failing on a password the user
    was never handed.

  The buttons are plain anchors, not JS-navigating buttons, so middle-click,
  open-in-new-tab and copy-link all keep working. Both brand marks are inlined
  SVG — the panel ships only FontAwesome's *solid* set, so the Google and Discord
  marks are not available as dependencies. Google keeps its four colours because
  their brand rules require the full mark on a light background; Discord is
  `currentColor` because theirs permit recolouring on light. The buttons are a
  light surface for the same reason: both marks are invisible on the dark page.
  They sit side by side and stack full-width below 420px, where two columns would
  leave "Continue with Discord" too narrow to fit on one line.
- **Account page** — `/account` is reduced to **the password form** and rebuilt in
  the theme. Stock Pterodactyl puts profile, password, email and two-step
  verification there as three side-by-side cards; this keeps the password form —
  Current Password, New Password (with the length-and-uniqueness hint), Confirm
  New Password, and an **Update Password** button — as a single dark chrome card on
  the light page, the same dark-island idiom as the server cards. The header
  carries the title and a **?** that reveals a help panel; it is a real button
  with `aria-expanded`, not a decorative circle. The confirm is **green**, matching
  the reference's account screen rather than the panel's blue submit.

  Under the confirm sits a second **green button, Change Email**, which opens
  `/account/email`. It is a `<Link>`, not a button with an `onClick`, so
  middle-click, open-in-new-tab and copy-link keep working — and an anchor cannot
  submit the form it happens to sit inside.

  It posts to the panel's own `/api/client/account/password`, so the current
  password is verified and the new one hashed by the panel's normal code — a
  reskin, not a reimplementation of authentication. The other account screens are
  dropped from this page but still **reachable**: the drawer's navigation list is
  untouched and the `/account/*` sub-routes still render the panel's components.

  The markup is hand-written rather than built on the panel's `Field`/`Input`,
  because the reference puts a glyph *inside* a light-filled box. `Input` wraps
  the `<input>` in its own div, so the box cannot be one flex row holding glyph
  and field, and the glyph would have to be positioned over it — the same
  fragility `.pt-auth-field-icon` carries on the auth screens, where its `top` is
  computed from the label's line box, its margin and the input's half-height. Here
  the glyph is a real flex sibling, so there is no arithmetic to keep in step, and
  the labels are real `<label for>` rather than positional associations.
- **Change email** — `/account/email` is a themed page for changing the address on
  the account: the current address shown as a value, then **New Email**, **Confirm
  New Email**, and — last, on purpose — the **Current Password** that gates the
  whole thing. Changing the address is how an account is taken over, and it is the
  one account change the panel does not confirm with a second factor, so the
  password is the page rather than a footnote.

  The password is checked **server-side**, by the panel's own `Hasher`. There is no
  client-side version of that rule to bypass by editing the form.

  A session opened with **Google or Discord cannot do this**, and that is enforced
  twice. `SocialAuthService` records the provider in the session on a social
  sign-in; `AccountEmailController` refuses such a session before it even looks at
  the password — before it on purpose, so a session that may not make the change
  cannot use it to test whether a password is correct either. On top of that, an
  account created through a provider holds a 48-character random password that
  nobody was ever given, so there is nothing to type into the box; the password
  check refuses it regardless, which also covers the case where the session marker
  is gone because “remember me” reopened the session from its cookie.

  In the UI that means a **sentence in place of the button**, not a disabled one:
  *Signed in with Google, so the address on this account cannot be changed here.*
  Offering a form that can only end in a refusal is offering a dead end. Visiting
  `/account/email` directly gets the same explanation and a way back.

  The write itself is entirely the panel's — `UserUpdateService`, the model's own
  `getRulesForUpdate()` validation, the panel's own three-changes-per-day email
  budget on the panel's own rate-limit key, and the `user:account.email-changed`
  activity log. Only the policy above is new. What forces a theme endpoint rather
  than the panel's own `PUT /api/client/account/email` is that `routes/api-client.php`
  is a panel file the theme does not ship, so there is nowhere to hang a middleware
  that knows about social sessions; hiding the button would have been the whole of
  the enforcement, and hiding a button is not a check.

### Server pages — the Aternos layout

Server pages get the reference's shape, in two parts.

**A fixed left rail, from `lg` up.** The dashboard and account pages are still the
topbar-only shell — three destinations and four respectively, and the topbar
carries them all as icon-over-label items. A server page is different: ten
destinations (Console, Files, Databases, Schedules, Users, Backups, Startup,
Network, Settings, Activity) plus the theme's own Plugins and Mods, and two
topbar icons cannot hold that without hiding them. So the rail is back — **on
server pages only**, which does mean server pages look different from the
dashboard. Say the word if you want it everywhere.

The rail's header shows the server's own name, short identifier and a power dot,
read from the same `ServerContext` the page reads, so it cannot disagree with the
status bar at the top. Below `lg` it is hidden with CSS and `aria-hidden` in the
markup — the mobile drawer is the real navigation at those widths, and two
navigations for one page is a screen reader reading the same list twice.

`Sidebar` gained a `variant` prop (`'drawer' | 'rail'`) rather than becoming two
components. The **navigation** must stay one list; only the frame around it
changes. Two components is how the rail and the drawer drift into offering
different destinations.

The rail's server identity arrives as **props**, and that is load-bearing rather
than stylistic. `AppShell` renders `Sidebar` for the mobile drawer on *every*
page, while `App.tsx` mounts `ServerContext.Provider` only around `/server/:id` —
so a `ServerContext` hook in `Sidebar` throws on `/` and `/account`, and the
panel's `ErrorBoundary` replaces the whole dashboard with **“An error was
encountered by the application while rendering this view. Try refreshing the
page.”** That is a *client-side* React render error, so it never reaches
`storage/logs` — a log check finds nothing at all, which is exactly what makes it
expensive. `ServerRouter` reads the values and passes them down; it is the only
place guaranteed to be inside the context.

Worth knowing before adding a component that reads server state: the same trap
waits for anything `AppShell` renders. Grep for
`ServerContext.useStoreState|useStoreActions` and confirm each hit is only
reachable from `ServerRouter`.

**The status panel at the top of the console.** Order is **Software, Version, then
the status band, then the four power buttons** — and the address moved down beside
the console, which is where it belongs: one is what an *owner* checks before
touching anything, the other is what a *player* needs while reading console
output. There is no Connect button; Aternos's opens a launcher dialog and nothing
on this panel does.

All four power signals share **one** button class — Start, Stop, Restart, Kill.
They were a large Start with two small square icons beside it, and two sizes read
as two different classes of action when they are the same class. Colour carries
the difference now: green start, red stop/kill, blue restart. They wrap rather
than scroll, because a power control you have to scroll sideways to find is one
you do not use.

The **address** sits above the terminal, next to `ServerDetailsBlock` (uptime,
CPU, memory, disk, network) — where you connect, and how the thing is doing.

What did *not* survive the translation, and why:

| Reference | Here | Why |
| --- | --- | --- |
| Blue RAM-boost banner | **Dropped** | It is Aternos selling an upgrade. On this panel it advertises a product that does not exist. |
| Connect button | **Dropped** | It opens a launcher dialog; there is nothing to launch here. |
| One large **Start** | Four buttons, same class | Dropping two power signals the panel offers would be a regression dressed as a match. |
| Software → **Change** | Only for a **root admin**, to the admin Software tab | Changing the egg is an admin action here — `updateBuild` takes allocations and limits and no `egg_id`. For anyone else there is **no button**, because a button that goes nowhere is the same failure as the “No egg assigned” string this theme already shipped once. |
| Version → **Change** | Always, to the panel's **Startup** page | That page is genuinely where a user changes those values. |
| Empty left card | Dropped | Its CPU/memory/disk readings are already in the console's own detail column, so a second card repeated them. |

Power goes over the `ServerContext` socket with `socket.send('set state', …)`,
exactly as the panel's own `PowerButtons` does — the socket is already open here
carrying the resource stats, and an HTTP call would be a second channel to the
same daemon.

Software is read from `GET /auth/servers/eggs`, because the panel's server
payload carries no egg name at all; Version comes from `serverVersionLabel()` over
the egg's variables, reading `serverValue` before `defaultValue` the way the panel
itself resolves a variable.
- **Dashboard server cards** — the third line of each card is the server **family**,
  not the egg name, because the panel never sends the egg name to the browser.
  `ServerTransformer` returns neither an egg name nor an egg id (`egg_features` is
  the only egg-derived field, and it is identical across the Minecraft eggs); the
  egg itself is only reachable through `?include=egg`, and `ServerController::index`
  never calls `parseIncludes()`, so that include is silently ignored.

  The card used to read `server.eggName || server.egg` and print **“No egg
  assigned”** when both were missing — which was *always*, because the panel sends
  neither. So every server on the dashboard claimed to have no egg, Paper servers
  included. A field the client cannot see is not a missing egg.

  What it prints now is the family derived from the egg's **variable names**, the
  same fingerprint `serverFamilyLabel()` in `lib/serverFamily.ts` already uses to
  decide which jar directories are worth probing. It says “Bukkit” and not
  “Paper” on purpose: Paper, Spigot and Purpur all carry `MINECRAFT_VERSION` and
  `BUILD_NUMBER`, so they are indistinguishable from the client, and naming one
  would be a guess that is wrong on the other two.

  When no family can be derived the card prints the **node name**, which the
  transformer always sends. That fallback is not hypothetical —
  `includeVariables()` returns a *null resource* (not an empty one) for a subuser
  without `ACTION_STARTUP_READ`, so their variables relationship is simply absent.

  And since guessing cannot name the egg, a small theme endpoint does: **`GET
  /auth/servers/eggs`** returns `{ uuid: "Paper" }` for every server the caller can
  see, from the panel's own `accessibleServers()` relation — the same one behind
  the server switcher — so owner and subuser access resolve through the panel's
  rules rather than a hand-written join. One request per dashboard load, not one
  per card. A root admin gets every server, which reveals nothing new since
  Admin → Servers already shows each server's egg, and without it the
  “show all servers” switch would leave other admins' cards on a guess.

  The card prefers the real name, falls back to the family, then to the node. It
  lives under `/auth/` for a structural reason worth knowing before you add
  another endpoint here: the panel loads route files *by name*, the theme ships
  two of them, and `routes/admin.php` is behind `AdminAuthenticate` — so
  `routes/auth.php` is the only web route file a normal user can reach.
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

- The **normal user panel** (React) is re-skinned: topbar-only shell, dashboard,
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
  - **Social Login** (`/admin/social-auth`) — Google and Discord sign-in. See
    *Social login* below for the flow, the security decisions, and what it does
    and does not do.

  The page is responsive: the blocks stack full-width on a phone, the preview
  sits beside its controls on desktop, and the range input stays full-width so
  it is usable on touch.
- **Quick links** — **Home** appears in the auth screens as a `Home / {screen}`
  breadcrumb in the top bar and a `Home` link in the footer bar.
  **Home**, **Discord** and **Status** are **no longer rendered in the dashboard
  topbar**, which is where the clipping problem came from (see *Topbar
  navigation* below). Nothing was removed from the settings: Admin → Site
  Settings → *Links* still stores all three, `lib/brand.ts` still exposes
  `quickLinks()` and `linkHref()`, and switching them back on is a one-line
  change to `NavigationBar`. Disabling a link in the admin still removes it.
  The auth screens also used to render their own row of pill buttons for these
  above the form; that row is gone — the breadcrumb already carries Home, the
  sign-up button is the loudest thing on the page, and a row of pills competed
  with both.

- **Topbar navigation** — a **two-column** grid: burger, brand lockup and a quiet
  page title on the left taking the slack, and on the right the icon-over-label
  **Servers** and **Account** items, the admin-only **Admin** shortcut, and a
  `pt-topbar-account` group holding the username with a logout button stacked
  beneath it and the round avatar at the end.

  That group exists to fix a clipping bug: the bar used to be
  `1fr auto 1fr` with an empty balancing column so the quick-link cluster could
  sit at 50%. Everything on the right then shared a single `1fr` track, and since
  the avatar is a fixed 2.5rem and cannot shrink, the **logout button absorbed
  the whole shortfall and disappeared underneath it**. The group is now
  `flex: none`, so it is measured at min-content and the lead column takes the
  shortfall instead — and the lead is what has an ellipsis on it. Below 900px the
  username drops first; below 640px the three navigation items drop too, since the
  mobile drawer duplicates exactly those. **Admin** appears here for a root admin.
  This is where the sidebar's navigation went, so the server and account pages are
  still one click away, and the mobile drawer still renders the full list for
  narrow screens. Search had no other home and is therefore still removed from the
  panel entirely.

- **Brand lockup** — the site icon beside the panel name sits in the topbar now,
  on a translucent white plate so a dark uploaded icon still separates from the
  dark bar. It falls back to the theme emblem.
- The **page title** stays exactly as Pterodactyl ships it. The **favicon** is the
  icon uploaded on the Site Settings page (falling back to the theme emblem) - the
  stock `/favicons` folder is removed on install and restored on uninstall.
- The **brand name** (topbar brand, page-title line, the auth heading and footer)
  is read from
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

**Keep it honest.** A preview that drifts from the real components is worse than
no preview: it will happily show you a screen that no longer exists. It already
had - the topbar mock still rendered the old search / dashboard / admin / avatar
/ sign-out row long after `NavigationBar.tsx` removed all five, and an audit
built on it produced two findings that were pure fiction. When a component
changes, check its section here:

```bash
# every pt-* class the preview uses must be styled by the theme
grep -oE 'class="[^"]*"' preview/index.html | grep -oE '\bpt-[a-z0-9-]+' | sort -u
```

Sections that show framework components the theme does not re-implement (alerts,
pagination, the stock buttons) are mocked in `preview/panel-preview.css`. Treat
what you see there as a placeholder, not as the installed panel - a mock alert
banner says nothing about the alerts the panel actually renders.

Regenerate the preview stylesheet, icon map and font list after changing the
palette or `tailwind.config.js`:

```bash
node preview/build-preview.js --panel /path/to/pterodactyl/panel
```

> `preview/` is for eyeballing the theme only â€” it is **not** in
> `manifest.json`, so the installers never copy it into a panel.

## Install

### Why an update can look like it did nothing

`templates/wrapper.blade.php` cache-busts the theme stylesheet on its **own
mtime** (`?v=@filemtime(...)`), because `config('app.version')` is the *panel's*
version and never changes on a theme update. Both installers therefore stamp each
copied file with the install time.

This is not housekeeping — it is what makes an update visible. The installers used
to copy with timestamp preservation (`cp -a` / `Copy-Item`), and git does not
rewrite a file it did not change, so pulling a commit that touched some *other*
theme file and re-running the installer re-copied the stylesheet with its **old**
mtime. The URL came out byte-identical, the browser served its cached copy, and
the update looked like it had done nothing.

Verified against both installers on a fixture panel root: the old one left the
mtime identical across `--update`, the new one moves it. If an update ever seems
to do nothing, check this before anything else:

```bash
stat -c '%y' /var/www/pterodactyl/public/themes/pterodactyl/css/pterodactyl-theme.css
grep -o 'pterodactyl-theme.css?v=[0-9]*' <the page source>
```

Those two numbers must match, and must be newer than your last install.

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

#### The three manifest actions

Every entry in `manifest.json` carries an `action`, and the two installers honour
all three:

| Action | Meaning |
| --- | --- |
| `create` | A file the panel does not have. Copied in, and recorded in `created.txt` so uninstall deletes it — there is no panel original to restore. |
| `replace` | A file the panel already has. The original is copied into the backup first, then overwritten. |
| `remove` | A file the theme **used to ship and no longer does**. |

`remove` exists because of `app/Support/IllustrationProcessor.php`. It went when
the hero illustration did, and dropping it from `manifest.json` alone would have
left the file sitting on every panel that had installed an earlier version — an
orphan nothing could clean up. With the entry present, both installers back the
panel's copy up before deleting it, so `--uninstall` puts it straight back.
`--update` deletes without a fresh backup, because an update deliberately keeps
the *original* backup rather than making a new one, and there is nothing there to
write into.

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

  The `neutral` / `gray` ramp is the **light** ramp, and it is deliberately
  **role-stable**: `700` is the card surface (`#ffffff`), `800` the page
  (`#f2f4f6`), `900` raised chrome (`#ffffff` again — on a light page a raised
  surface is separated by its shadow, not by a different fill), `600` a row fill
  and border (`#dfe3e8`), and `50`–`500` the ink steps (`#10131a` down to
  `#696f7b`).

  The roles are the point. When this ramp was dark, the same slots held the
  opposite values, and keeping the slots is what lets the stock panel build every
  surface from `neutral-700/800/900` and its every piece of text from
  `text-neutral-*` and land on the new palette with no per-page overrides. The
  polarity flipped; the job each step does did not.

  `700` and `900` being the same value is deliberate, not a missing step. The
  dark chrome islands do **not** come from this ramp: the topbar, the server
  cards and the console header are `--pt-chrome` (`#2d3748`) with their own
  `--pt-chrome-ink` / `-muted` / `-faint` steps, because the page ink is dark and
  would be unreadable on them.

  The two ramps live in **two files** and must stay byte-for-byte identical:
  `--pt-*` in `pterodactyl-theme.css`, and the literal `PALETTE` in
  `tailwind.config.js`. The second is what a panel on Tailwind below 3.1 actually
  renders, so drift there shows the old colours while the stylesheet declares the
  new ones — indistinguishable from the stylesheet not having applied.
  Corners are square everywhere: a global radius reset also neutralises the stock
  panel's rounding.


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
| `public/themes/pterodactyl/css/pterodactyl-theme.css` | create - light tokens + dark chrome islands + shell/auth/dashboard/console/files styles |
| `public/themes/pterodactyl/images/logo.svg` | create â€” brand mark |

**Shell**

| File | Action |
| --- | --- |
| `resources/scripts/components/AppShell.tsx` | create — topbar + drawer shell on every page, plus a fixed desktop rail on SERVER pages only. The rail lives here rather than in ServerRouter so `mode` stays the one thing that decides the shell
| `resources/scripts/components/Sidebar.tsx` | create — full nav list, used in the mobile drawer everywhere and in the fixed desktop rail on server pages. A `variant` prop swaps the frame (brand + footer in the drawer, server identity block in the rail) without forking the navigation into two lists
| `resources/scripts/components/NavigationBar.tsx` | replace â€” brand lockup, icon-over-label nav, and a `pt-topbar-account` group (username, logout, avatar) that cannot be squeezed |
| `resources/scripts/routers/DashboardRouter.tsx` | replace â€” wraps in `AppShell` |
| `resources/scripts/routers/ServerRouter.tsx` | replace â€” wraps in `AppShell` |

**Pages**

| File | Action |
| --- | --- |
| `components/dashboard/{DashboardContainer,ServerRow}.tsx` | replace - the card's third line is the server's **software**, from `GET /auth/servers/eggs`, because the panel's servers list carries no egg name (see *Dashboard server cards* below) |
| `components/server/status/ServerStatusPanel.tsx` | create - the Aternos-shaped block at the top of a server page: address card, status bar, large power button, Address/Software/Version rows |
| `components/auth/{LoginFormContainer,LoginContainer,LoginCheckpointContainer,ForgotPasswordContainer,ResetPasswordContainer}.tsx` | replace - `LoginFormContainer` is the flat dark-page shell shared by every auth screen: emblem centred above the heading, sign-up CTA, form on the page with no card |
| `components/auth/RegisterContainer.tsx` | create - public sign-up form: accent-split heading, per-field glyph, placeholders, required asterisks, two-up name row |
| `api/auth/register.ts` | create - CSRF + `POST /auth/register` |
| `routers/AuthenticationRouter.tsx` | replace |
| `components/account/AccountCard.tsx` | create - the card, the labelled control and the read-only value the two account screens share |
| `components/account/AccountOverviewContainer.tsx` | create - the password form, plus the green **Change Email** button under the confirm |
| `components/account/AccountEmailContainer.tsx` | create - `/account/email`: new address, confirmation, and the current password that gates the change |
| `api/client/account.ts` | create - `POST /api/client/account/password` (the panel's) and `PUT /auth/account/email` (the theme's, see *Change email* above) |
| `lib/accountRoutes.ts` | create - the account routes the theme owns, shared by router/topbar/sidebar |
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
| `app/Http/Controllers/Auth/AccountEmailController.php` | create - `PUT /auth/account/email`: refuses a provider session first, then the panel's `Hasher` checks the current password, then the panel's `UserUpdateService` does the write |
| `app/Http/Controllers/Auth/ServerEggController.php` | create - `GET /auth/servers/eggs`: the egg name per server the caller can see, which the panel's own servers list cannot supply |
| `app/Services/Social/SocialAuthService.php` | create - the Google/Discord OAuth2 flow: state, code exchange, profile, account resolution. No Socialite, no Composer change |
| `app/Http/Controllers/Auth/SocialAuthController.php` | create - `GET /auth/social/{provider}/redirect` and `/callback`. A successful callback also records the provider in the session, which is what keeps a social session out of *Change email* |
| `app/Http/Controllers/Admin/SocialAuthController.php` | create - Admin -> Social Login: client id, encrypted secret, per-provider switch, clear-secret |
| `resources/views/admin/social-auth.blade.php` | create - one card per provider, with the copyable callback URL to register |
| `app/Http/ViewComposers/AssetComposer.php` | replace - exposes `SiteConfiguration.logo` / `.registration` / `.backgrounds` / `.social.providers` / `.account` |
| `routes/auth.php` | replace - stock routes + `GET/POST /auth/register` + the two social routes + `PUT /auth/account/email` + `GET /auth/servers/eggs`, no recaptcha middleware |
| `routes/admin.php` | replace - stock routes + `/admin/site-settings` (+ `/illustration` save and clear) + `/admin/registration` + `/admin/social-auth` |
| `app/Support/IllustrationProcessor.php` | removed - the hero illustration it keyed and cropped is gone with the split layout |
| `resources/views/layouts/admin.blade.php` | replace - Site Settings + Registration + Social Login menu items, icon favicon |
| `resources/scripts/components/auth/SocialLoginButtons.tsx` | create - the provider button row, or nothing when none is configured; both marks inlined SVG |
| `resources/scripts/lib/brand.ts` | create - `brandName()`/`logoUrl()`/`registrationEnabled()`/`backgroundStyle()`/`linkHref()`/`socialProviders()`/`accountAccess()` from `SiteConfiguration` |
| `resources/scripts/lib/theme.ts` | create â€” `ptColor` (Chart.js helper; dark-only, no theme state) |

Server-side rendering, permissions and the database are unaffected. The API
routes are too, apart from the one addition noted above: social sign-in is
**not** an API route. It is two server-side redirects, because a provider
redirects the browser to a callback URL registered in advance and the React
router has no say in where that lands.

### What social login does not add

Worth being explicit, because "social login" usually implies more than this:

- **No new panel route, permission or database column.** Accounts are matched by
  email, so there is no `users.provider_id` column and no separate identities
  table. Signing in with a second provider that has the same verified address
  lands on the same account.
- **No unlinking, and no per-provider linking.** There is no Account settings
  page for it. The link is implicit and permanent; to stop someone signing in
  with a provider, switch that provider off in Admin → Social Login, or change
  the address on the panel account so it no longer matches.
- **No 2FA bypass.** Accounts with 2FA are refused, not signed in.
- **No avatar import.** A provider profile picture is not copied to the panel;
  users keep the avatar they already have.
- **No `composer require`.** Nothing is added to the panel's dependencies.

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
| `api/server/eggs.ts` | create - `GET /auth/servers/eggs`; one request per dashboard load |
| `lib/serverFamily.ts` | create - which flavours a server can take, and `serverFamilyLabel()` so the card can print a truthful fallback while `/auth/servers/eggs` loads |
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
  (`Brine::registration_enabled`). Social sign-in reads this same switch: an
  address with no account is only turned into one while it is on.
- **Social login** - Admin -> **Social Login**. Each of Google and Discord is a
  client id, a client secret and a switch, stored as
  `Brine::social_<provider>_enabled` / `_client_id` / `_client_secret`; the
  **secret is encrypted** with the panel's `APP_KEY` and never sent back to the
  browser. A provider reaches `SiteConfiguration.social.providers` — and so the
  login screen — only when it is both enabled and completely configured, so a
  half-configured provider is visible on the admin page as **NEEDS CREDENTIALS**
  rather than as a button that fails. Adding a third provider means adding one
  entry to `SocialAuthService::PROVIDERS`, one card to the admin view, and one
  mark to `SocialLoginButtons`; nothing else changes.
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
- **Auth layout (single centred column)** - every auth screen (login, register,
  forgot, reset, 2FA) is one centred column, following the Aternos reference.
  `LoginFormContainer` is the shared shell:
  - This replaced a 50/50 split. The hero half existed to carry a hero
    illustration; with the illustration gone the second column only pushed the
    form off a laptop screen, so the layout is now a single column and the accent
    colour carries the emphasis the artwork used to.
  - `.pt-auth-page` owns the admin's **Login & register** background image and the
    scrim, as the page's own background. It used to be a `position: fixed`
    `::after` on the whole page, then the hero half's background - both are gone,
    but the `--pt-bg-overlay-*` variables Site Settings writes are unchanged.
  - `.pt-auth` is the column: the brand lockup (mark + site name) at the top, then
    `.pt-auth-column` holding the heading, the call to action and the card. The
    mark's backing is a dim surface rather than the old white chip - a white box
    read as a sticker on a black screen, and it forced light-on-dark - but a
    backing is kept at all so a dark uploaded icon still separates from the page.
  - The heading sits **outside** the card on the page, as in the reference. The
    card itself is body + footer only; the old header band is gone.
  - The **Sign up** call to action is the loudest element on the login screen -
    registration is the reason a first-time visitor is there at all. It renders
    only when `registrationEnabled()` is true, so it can never link to a route the
    admin has closed, and `showSignUpCta={false}` turns it off on the register
    screen where the footer already offers the same link. It is an `<a>`, not a
    `<button>`, so it has to override the generic `.pt-auth a` colour or it
    renders as a link rather than a filled surface.
  - `--pt-blue-*` is a new ramp used by the sign-up CTA and the submit button and
    nothing else. The rest of the panel stays monochrome; gold remains the link
    colour throughout, so a link never reads as a button. **The ramp runs down,
    not up**: `500` is the fill and `400`/`600` (hover/active) are *darker*. A
    lighter-on-hover ramp is impossible with white text here, because the
    reference's own `#2b7cd3` is only 4.26:1 against white. The shipped fill is
    `#2977cb` - 96% of that blue, so it reads as the same colour - and measures
    4.57:1, with hover and active at 5.69:1 and 7.26:1. All AA.
  - The submit button is a rounded rect on **both** palettes, not a pill - a pill
    on a 44px button reads as a toggle, not a call to action.
  - "Forgot password?" is its own link **under** the password field rather than on
    the label row, matching the reference. `components/elements/Field.tsx` still
    carries the optional `labelAction` prop for other callers; nothing on the auth
    screens uses it now, but it is additive and byte-for-byte stock without it, so
    the other ~200 `Field` call sites in the panel are untouched.
  - `.pt-auth` needs `min-width: 0`: a flex item defaults to `min-width: auto` and
    refuses to shrink below its content, so without it the card's max-width
    pushed the page sideways on a phone. The responsive overrides are declared
    **after** every base rule on purpose - a media query adds no specificity, so
    one declared first is simply overwritten by the base rule below it.
  - The `Home / <screen>` breadcrumb is page chrome pinned to the viewport's
    top-left corner, so it lives in `AuthenticationRouter` rather than in the
    column - `.pt-auth`'s top padding clears it at every breakpoint.
  - reCAPTCHA stays disabled (see *reCAPTCHA* below), so no widget renders. The
    field label stays **Username or Email** rather than the reference's "Email
    address", because the login endpoint accepts either and a narrower label
    would be wrong for anyone signing in with their username.
- **Uploaded images always replace, never come back.** The icon is stored under a
  fixed stem with a per-upload extension (`images/custom-logo.<ext>`,
  `backgrounds/bg-<slot>.<ext>`), which has two consequences that are easy to get
  wrong and were both wrong here:
  - The served URL had **no cache-buster**, so it was byte-identical before and
    after a replacement. Browsers cache favicons and logos hard, so the file on
    disk changed and the screen did not - the *previous* image stayed. Every
    uploaded image now carries its mtime as `?v=`, which is the same trick the
    stylesheet uses.
  - "Delete the old one" has to mean **delete all of them**. Removing only the
    first `glob()` match meant that if two files ever coexisted, clearing the
    icon left one behind and it returned on the next render. Replacing an upload
    now clears every match, and every read picks the **newest** file rather than
    whatever order the filesystem returned, so a stale leftover can never take
    the slot back.
  - The post-upload check tests the exact filename just written. Asking "can I
    resolve *something*?" was satisfied by a leftover and reported success for
    an upload that never landed.
  - The favicon's `type` is derived from the extension instead of being hardcoded
    to `image/png`, which lied for every format except PNG.
- **Elevation, hairlines and motion are shared scale tokens, not per-component
  values.** `--pt-shadow-sm/md/lg`, `--pt-hairline` and `--pt-dur-fast/base/slow`
  replaced fifteen hand-written `box-shadow`s, four border greys and two unit
  systems for the same duration (`150ms` and `0.15s`). On a true-black page
  there is no luminance for a shadow to borrow, so elevation can only be read
  from opacity - which is exactly what a shared scale fixes. The amber palette
  redefines the three shadows as flat outlines, because that palette is
  deliberately shadowless; the durations and the border greys are shared. The
  easing is left as the literal `ease` on purpose: routing all twenty-eight
  through one custom curve would change how every hover in the panel animates at
  once, for a consistency gain nobody can see.
- **`prefers-reduced-motion` covers the whole theme.** It used to exempt only the
  drawer, leaving every other transition running for a user who has asked the
  operating system not to animate anything. It is scoped to the theme's own
  classes rather than a blanket `* { transition: none }`, because the panel draws
  things whose motion carries meaning - the xterm cursor, the resource bars - and
  freezing those would be a different accessibility bug. Animations are left
  alone for the same reason; only transitions are cut.
- **The auth layout is embeddable at any height.** `.pt-auth` no longer sets
  `min-height: 100vh` on top of `.pt-auth-page`'s; the inner element stretches to
  the page for free as a flex item. Redundant on the panel, and it meant the auth
  screen could only ever be as tall as the viewport.
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
  status (not installed) → install → status (installed) → double install refused
  → update (single original backup kept, works only while installed) →
  uninstall → status (not installed), with every original file verified
  byte-identical to the pristine fixture afterwards.

### Checked for the change-email release, in this checkout

No panel checkout was present here, so the checks above were not re-run. What was
run, and what it covered:

- `php -l` clean on `AccountEmailController.php`, `SocialAuthService.php`,
  `AssetComposer.php` and `routes/auth.php` under PHP 8.4.
- `tsc --noEmit` over every touched TS/TSX file, in a scratch project with the
  third-party typings (react 18, formik, yup, react-router 5, fontawesome 6)
  installed and `@/*` mapped at the theme's own `resources/scripts`. Clean apart
  from `TS2307` for the panel modules the theme does not ship, and the
  `Spinner`/`twin.macro` cascade that follows from them — none of it in the files
  this change touches.
- Stylesheet braces balanced 325/325.
- `manifest.json` parses; 72 entries, and all 70 `create`/`replace` payloads are
  present under `theme/`.

The panel-side checks that actually exercise this feature — signing in with
Google and confirming the button is absent, signing in with a password and
changing the address, and `yarn build:production` against a real panel — are still
to be run wherever the panel is available.

### Compiling every Blade template — do not skip this

`php -l` does **not** work on a `.blade.php` file: the file is mostly markup, so
the linter reads the first tag as PHP and reports a parse error on a template
that is perfectly fine. That mistake hid two genuinely broken templates for
several releases. Passing `php -l` on a Blade template means nothing.

The check that does work is to compile each template with the panel's own
compiler and lint the **output**:

```php
// run in the panel root, as the web user
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$compiler = $app->make('blade.compiler');
foreach (glob('resources/views/**/*.blade.php') as $f) {
    file_put_contents('/tmp/out.php', $compiler->compileString(file_get_contents($f)));
    passthru('php -l /tmp/out.php');
}
```

Two failures came out of exactly this, and neither was visible anywhere except as
a 500 on one admin page:

| Template | What was wrong | What it broke |
| --- | --- | --- |
| `admin/servers/partials/navigation.blade.php` | A raw `<?php` opener with a Blade `@endphp` closer. Blade only rewrites an `@php`/`@endphp` *pair*, so the `@endphp` reached the compiled view verbatim, and the untouched `<?php` really did open a block that ran into the markup below: `syntax error, unexpected token "class"`. | **Every** `/admin/servers/view/*` page, because `view/index.blade.php` includes this partial. It is also what made a *successful* server creation look broken: `CreateServerController@store()` ends with a redirect to `/admin/servers/view/{id}`, so the browser landed straight on the 500 and it read as "create is broken". |
| `admin/servers/view/software.blade.php` | `${$bucket}Family[$nestName][] = $egg` — the `${...}` variable-variable is a **parse error** on PHP 8.2+. Blade passes it through untouched, since it is not a Blade construct. | The Software tab, on any PHP 8.2+ install. |

Run it against the **panel's** PHP, not whatever is on the machine doing the
checking — that is what turned the second one from "looks wrong" into a hard parse
error. For the non-Blade PHP (`app/`, `routes/`), a plain `php -l` over each file
is enough, and all 12 pass.

### Three checks that are not optional, and are not `tsc`

Both of these are classes of bug that typecheck clean and lint clean and still
take the panel down.

**3. Paired Tailwind colours invert with the palette.** This theme deliberately
flips the neutral ramp — 50-500 become ink, 600-900 become surfaces — which is
what lets the stock panel's ~200 colour utilities re-skin onto a light page
without a component edit. But any panel component that pairs a *light* text step
with a *dark* surface step inverts into light-on-light and becomes invisible, and
nothing warns: it is valid CSS, it just reads as blank.

The one that bit is the copy toast, emitted by `CopyOnClick` as
`text-gray-200 bg-neutral-600/95`. It is now overridden in the stylesheet as an
exact class **combination**, because `text-gray-200` on its own is correct all
over the panel and overriding that half would darken half the panel to fix one
toast. When you add a panel component that pairs the ramp against itself, check
both halves explicitly rather than trusting either one's polarity.

**1. FontAwesome names must exist in the panel's installed set.** The panel pins
`@fortawesome/free-solid-svg-icons` to `^5.15.1` and `@fortawesome/react-fontawesome`
to `^0.1.11` — the FontAwesome **5** line, one copy on disk. A FA6 name is not
merely renamed there, it does not exist, and the import fails at **build** time:

```
export 'faCircleQuestion' was not found in '@fortawesome/free-solid-svg-icons'
```

That takes down *every* page in the panel, over a question mark on one card. The
theme shipped `faCircleQuestion` in the account card for two releases; nothing
caught it, because it typechecks against whatever typings are installed locally
and the panel was never built. Use the FA5 names — `faQuestionCircle`,
`faSyncAlt`, `faCog` — and never `faCircleQuestion`, `faArrowsRotate` or `faGears`.

```bash
cd /var/www/pterodactyl
grep -rhoE "import \{[^}]*\} from '@fortawesome/free-solid-svg-icons'" resources/scripts \
  | sed 's/import {//; s/} from.*//' | tr ',' '\n' | tr -d ' ' | grep -E '^fa[A-Z]' | sort -u \
  | while read -r n; do
      grep -qE "(^|[^A-Za-z0-9_])$n([^A-Za-z0-9_]|$)" node_modules/@fortawesome/free-solid-svg-icons/index.d.ts \
        && echo "OK   $n" || echo "MISS $n"
    done
```

Match only names inside the `import { … }` statement. A plain grep also matches
icon names mentioned in prose — a file that *warns against* `faCircleQuestion`
then reads as importing it.

**2. `manifest.json` must have no duplicate `path`s.** A duplicate entry means
the installer copies the same file twice, on every run, and — worse — it hides
the fact that an entry is stale: the note you are reading may belong to a copy
that lost the argument six commits ago. `ConvertFrom-Json` accepts duplicates
happily, so nothing complains.

```powershell
$m = Get-Content -Raw manifest.json | ConvertFrom-Json
$m | Group-Object path | Where-Object Count -gt 1 | Select-Object Count, Name
```

This found a real one: the `DashboardRouter.tsx` entry from the change-email
release was left behind when its replacement was added alongside it rather than
in place of it.

