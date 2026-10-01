@extends('layouts.admin')

@section('title', 'Site Settings')

@section('content-header')
    <h1>Site Settings<small>Name, icon and background images for the user panel.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Site Settings</li>
    </ol>
@endsection

@section('content')
    <style>
        /* All page styling is scoped under .bs-ss so nothing leaks into the rest
           of the admin area. */
        .bs-ss .bs-ss-tabs { margin-bottom: 18px; }
        .bs-ss .bs-ss-tabs > li > a { padding: 10px 16px; }

        .bs-ss .bs-ss-stack { margin-bottom: 18px; }
        .bs-ss .bs-ss-stack:last-of-type { margin-bottom: 0; }

        /* Preview frame. The inner <img> is what gets replaced on upload, and the
           scrim above it is what the intensity slider drives. */
        .bs-ss .bs-ss-frame {
            position: relative;
            overflow: hidden;
            border: 1px solid #d2d6de;
            border-radius: 4px;
            background: #19152e;
        }
        .bs-ss .bs-ss-frame img {
            display: block;
            width: 100%;
            max-height: 240px;
            object-fit: cover;
        }
        .bs-ss .bs-ss-frame .bs-ss-scrim {
            position: absolute;
            inset: 0;
            pointer-events: none;
        }
        .bs-ss .bs-ss-empty {
            padding: 26px 14px;
            text-align: center;
            color: #8a94a6;
            font-size: 12px;
        }

        /* Icon preview: a fixed chip so a wide or short upload still reads. */
        .bs-ss .bs-ss-icon-frame {
            display: grid;
            place-items: center;
            width: 96px;
            height: 96px;
            padding: 8px;
            border: 1px solid #d2d6de;
            border-radius: 4px;
            background: #f3f4f6;
        }
        .bs-ss .bs-ss-icon-frame img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        /*
         * The intensity slider.
         *
         * It must NOT carry .form-control: Bootstrap 3 styles that class as a
         * text input (height, padding, border, background), which is why the
         * earlier version had to strip padding and border back off with inline
         * styles and left the control looking broken and hard to grab. This
         * styles the range input directly instead, which is the only reliable
         * way to get a usable slider in a Bootstrap 3 form.
         */
        .bs-ss .bs-ss-range {
            -webkit-appearance: none;
            appearance: none;
            display: block;
            width: 100%;
            height: 22px;
            margin: 0;
            padding: 0;
            background: transparent;
            border: 0;
        }
        .bs-ss .bs-ss-range::-webkit-slider-runnable-track {
            height: 6px;
            border-radius: 999px;
            background: #d2d6de;
        }
        .bs-ss .bs-ss-range::-moz-range-track {
            height: 6px;
            border-radius: 999px;
            background: #d2d6de;
        }
        .bs-ss .bs-ss-range::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            margin-top: -7px;
            border: 0;
            border-radius: 50%;
            background: #3c8dbc;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }
        .bs-ss .bs-ss-range::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border: 0;
            border-radius: 50%;
            background: #3c8dbc;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }
        .bs-ss .bs-ss-range:focus {
            outline: none;
        }
        .bs-ss .bs-ss-range:focus::-webkit-slider-thumb {
            box-shadow: 0 0 0 3px rgba(60, 141, 188, 0.35);
        }

        .bs-ss .bs-ss-readout {
            display: inline-block;
            min-width: 3.2em;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
        }

        .bs-ss .bs-ss-field { margin-bottom: 14px; }
        .bs-ss .bs-ss-field:last-child { margin-bottom: 0; }

        .bs-ss .bs-ss-label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
        }
        .bs-ss .bs-ss-or {
            margin: 12px 0;
            color: #8a94a6;
            font-size: 12px;
            text-align: center;
        }

        /* ---------------------------------------------------- theme tab -- */
        .bs-ss-themes { display: grid; gap: 10px; margin-top: 14px; }

        .bs-ss .bs-ss-theme {
            display: flex;
            align-items: center;
            gap: 14px;
            margin: 0;
            padding: 12px 14px;
            border: 1px solid #dfe3ea;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 400;
            transition: border-color 0.15s, background-color 0.15s, box-shadow 0.15s;
        }
        .bs-ss .bs-ss-theme:hover { border-color: #b9c1ce; background-color: #fbfcfd; }
        .bs-ss .bs-ss-theme.is-selected {
            border-color: #3c8dbc;
            background-color: #f2f8fc;
            box-shadow: 0 0 0 1px #3c8dbc inset;
        }

        /* The native radio stays in the DOM for the form and for keyboard and
           screen-reader use, but the card is the visible control. */
        .bs-ss .bs-ss-theme-input { position: absolute; opacity: 0; width: 1px; height: 1px; }
        .bs-ss .bs-ss-theme-input:focus-visible + .bs-ss-theme-swatch {
            outline: 2px solid #3c8dbc;
            outline-offset: 3px;
        }

        .bs-ss .bs-ss-theme-swatch {
            display: flex;
            flex: 0 0 auto;
            overflow: hidden;
            width: 74px;
            height: 46px;
            border: 1px solid rgba(15, 23, 42, 0.18);
            border-radius: 6px;
        }
        .bs-ss .bs-ss-theme-swatch > i { flex: 1 1 0; }

        .bs-ss .bs-ss-theme-body { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; }
        .bs-ss .bs-ss-theme-name { font-size: 14px; font-weight: 600; }
        .bs-ss .bs-ss-theme-tag { vertical-align: middle; margin-left: 6px; font-weight: 400; }
        .bs-ss .bs-ss-theme-blurb { margin-top: 3px; color: #8a94a6; font-size: 12px; line-height: 1.45; }

        .bs-ss .bs-ss-theme-tick { flex: 0 0 auto; color: #3c8dbc; opacity: 0; }
        .bs-ss .bs-ss-theme.is-selected .bs-ss-theme-tick { opacity: 1; }

        @media (max-width: 600px) {
            .bs-ss .bs-ss-theme { flex-wrap: wrap; }
            .bs-ss .bs-ss-theme-swatch { width: 100%; height: 34px; }
        }
    </style>

    <div class="bs-ss">
        @foreach ($errors->all() as $error)
            <div class="alert alert-danger">{{ $error }}</div>
        @endforeach

        {{-- Server-rendered tabs: plain links into ?tab=, so they need no
             JavaScript and cannot break on load order. --}}
        <ul class="nav nav-tabs bs-ss-tabs">
            <li class="{{ $tab === 'general' ? 'active' : '' }}">
                <a href="{{ route('admin.site-settings', ['tab' => 'general']) }}">
                    <i class="fa fa-picture-o"></i> <span>General &amp; backgrounds</span>
                </a>
            </li>
            <li class="{{ $tab === 'theme' ? 'active' : '' }}">
                <a href="{{ route('admin.site-settings', ['tab' => 'theme']) }}">
                    <i class="fa fa-paint-brush"></i> <span>Theme</span>
                </a>
            </li>
            <li class="{{ $tab === 'links' ? 'active' : '' }}">
                <a href="{{ route('admin.site-settings', ['tab' => 'links']) }}">
                    <i class="fa fa-link"></i> <span>Links</span>
                </a>
            </li>
        </ul>

        @if ($tab === 'general')

            {{-- =============================================== 1. name + icon -- --}}
            <form action="{{ route('admin.site-settings.general') }}" method="POST" enctype="multipart/form-data" class="bs-ss-stack">
                @csrf
                <div class="box">
                    <div class="box-header with-border">
                        <h3 class="box-title"><i class="fa fa-pencil"></i> Name &amp; icon</h3>
                    </div>
                    <div class="box-body">
                        <div class="row">
                            <div class="col-sm-8">
                                <div class="bs-ss-field">
                                    <label class="control-label bs-ss-label" for="siteName">Site name</label>
                                    <input type="text" id="siteName" name="name" class="form-control" maxlength="191" required
                                           value="{{ old('name', $name) }}" />
                                    <p class="help-block">
                                        Shown in the browser tab, the sidebar, the topbar, the login card and the footer.
                                        Stored as the panel&rsquo;s own site name, so everything rebrands at once.
                                    </p>
                                </div>

                                <div class="bs-ss-field">
                                    <label class="control-label bs-ss-label" for="siteIcon">Choose a file</label>
                                    <input type="file" id="siteIcon" name="icon"
                                           accept=".png,.svg,.jpg,.jpeg,.ico,.gif,.webp"
                                           data-icon-preview="iconPreviewImage" />
                                    <p class="help-block">
                                        PNG, SVG, JPG, ICO, GIF or WEBP up to {{ $upload_ceiling_kb }} KB &mdash; whichever is
                                        smaller, this theme&rsquo;s cap and what this server&rsquo;s PHP will actually accept.
                                        Square artwork looks best; the same file becomes the favicon everywhere.
                                    </p>
                                </div>

                                <p class="bs-ss-or">— or —</p>

                                <div class="bs-ss-field">
                                    <label class="control-label bs-ss-label" for="iconUrl">Paste a link</label>
                                    <input type="text" id="iconUrl" name="icon_url" class="form-control" maxlength="2048"
                                           placeholder="https://example.com/icon.png"
                                           value="{{ old('icon_url', $icon_url) }}"
                                           data-icon-link="iconPreviewImage" />
                                    <p class="help-block">
                                        A direct <code>https://</code> link to an image. A link here is used instead of an
                                        uploaded file.
                                    </p>
                                </div>

                                @if ($icon)
                                    <div class="checkbox checkbox-danger no-margin-bottom">
                                        <input id="removeIcon" name="remove_icon" type="checkbox" value="1" />
                                        <label for="removeIcon" class="strong">Remove the icon and go back to the default emblem</label>
                                    </div>
                                @endif
                            </div>

                            <div class="col-sm-4">
                                <div class="bs-ss-icon-frame">
                                    <img id="iconPreviewImage"
                                         src="{{ $icon ?: '/themes/pterodactyl/images/logo.svg' }}"
                                         alt="Current icon preview" />
                                </div>
                                <p class="help-block" style="margin-top: 8px;">
                                    @if ($icon)
                                        Saved icon - used as the favicon and the login emblem.
                                    @else
                                        No custom icon yet - the theme emblem is in use.
                                    @endif
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="box-footer">
                        <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> Save name &amp; icon</button>
                    </div>
                </div>
            </form>

            {{-- ============================================ 2 + 3. backgrounds -- --}}
            @foreach (['auth' => 'Login &amp; Register', 'dashboard' => 'Dashboard'] as $slot => $label)
                @php
                    $slotData = $backgrounds[$slot];
                    $overlay = $slotData['overlay'];
                @endphp
                <form action="{{ route('admin.site-settings.background', ['slot' => $slot]) }}" method="POST"
                      enctype="multipart/form-data" class="bs-ss-stack">
                    @csrf
                    <div class="box">
                        <div class="box-header with-border">
                            <h3 class="box-title"><i class="fa fa-image"></i> {!! $label !!} background</h3>
                            <div class="pull-right">
                                <span class="label {{ $slotData['enabled'] ? 'label-success' : 'label-default' }}">
                                    {{ $slotData['enabled'] ? 'ON' : 'OFF' }}
                                </span>
                            </div>
                        </div>
                        <div class="box-body">
                            <div class="checkbox no-margin-bottom">
                                <input id="{{ $slot }}Enabled" name="{{ $slot }}_enabled" type="checkbox" value="1"
                                       {{ old($slot . '_enabled', $slotData['enabled']) ? 'checked' : '' }} />
                                <label for="{{ $slot }}Enabled" class="strong">Show this background</label>
                            </div>

                            <div class="row" style="margin-top: 14px;">
                                <div class="col-sm-6">
                                    <div class="bs-ss-field">
                                        <label class="control-label bs-ss-label" for="{{ $slot }}File">Choose a file</label>
                                        <input type="file" id="{{ $slot }}File" name="{{ $slot }}_file"
                                               accept=".png,.jpg,.jpeg,.gif,.webp,.svg"
                                               data-bg-preview="{{ $slot }}PreviewImage"
                                               data-bg-scrim="{{ $slot }}PreviewScrim" />
                                        <p class="help-block">Up to {{ $upload_ceiling_kb }} KB, as set by this server&rsquo;s PHP.</p>
                                    </div>

                                    <p class="bs-ss-or">— or —</p>

                                    <div class="bs-ss-field">
                                        <label class="control-label bs-ss-label" for="{{ $slot }}Url">Paste a link</label>
                                        <input type="text" id="{{ $slot }}Url" name="{{ $slot }}_url" class="form-control"
                                               maxlength="2048" placeholder="https://example.com/background.jpg"
                                               value="{{ old($slot . '_url') }}"
                                               data-bg-link="{{ $slot }}PreviewImage"
                                               data-bg-scrim="{{ $slot }}PreviewScrim" />
                                        <p class="help-block">A direct <code>https://</code> link to an image.</p>
                                    </div>

                                    <div class="bs-ss-field">
                                        <label class="control-label bs-ss-label" for="{{ $slot }}Intensity">
                                            Overlay intensity
                                            <span class="bs-ss-readout" id="{{ $slot }}IntensityOut">{{ old($slot . '_overlay_intensity', $overlay['intensity']) }}%</span>
                                        </label>
                                        <input type="range" class="bs-ss-range" min="0" max="100" step="1"
                                               id="{{ $slot }}Intensity"
                                               name="{{ $slot }}_overlay_intensity"
                                               value="{{ old($slot . '_overlay_intensity', $overlay['intensity']) }}"
                                               data-bg-scrim="{{ $slot }}PreviewScrim" />
                                        <p class="help-block">
                                            A black layer over the image, so the dark text stays readable. Lower it for a
                                            bright photo, raise it for a dark one.
                                        </p>
                                    </div>
                                </div>

                                <div class="col-sm-6">
                                    <div class="bs-ss-frame">
                                        @if ($slotData['image'])
                                            <img id="{{ $slot }}PreviewImage" src="{{ $slotData['image'] }}"
                                                 alt="{{ strip_tags(html_entity_decode($label)) }} background preview" />
                                        @else
                                            <img id="{{ $slot }}PreviewImage" src="" alt="" style="display: none;" />
                                            <div class="bs-ss-empty" id="{{ $slot }}PreviewEmpty">
                                                No image set yet.<br />Choose a file or paste a link, then save.
                                            </div>
                                        @endif
                                        <span class="bs-ss-scrim" id="{{ $slot }}PreviewScrim"
                                              style="background: #000; opacity: {{ $overlay['intensity'] / 100 }}; {{ $slotData['image'] ? '' : 'display: none;' }}"></span>
                                    </div>

                                    @if ($slotData['image'])
                                        <p class="help-block" style="margin-top: 8px;">
                                            This is the image that is live now. Changes show here before you save.
                                        </p>
                                    @endif
                                </div>
                            </div>
                        </div>
                        <div class="box-footer">
                            @if ($slotData['image'])
                                <button type="submit" form="clear-{{ $slot }}" class="btn btn-danger btn-sm"
                                        onclick="return confirm('Remove this background?');">
                                    <i class="fa fa-trash"></i> Clear background
                                </button>
                            @endif
                            <button type="submit" class="btn btn-primary">
                                <i class="fa fa-save"></i> Save {!! strtolower($label) !!}
                            </button>
                        </div>
                    </div>
                </form>
            @endforeach

            {{-- DELETE forms live outside the save forms: nested <form> elements are
                 invalid HTML and browsers drop the inner one. The buttons above
                 carry form="clear-…" to target these. --}}
            @foreach (['auth', 'dashboard'] as $slot)
                <form id="clear-{{ $slot }}" action="{{ route('admin.site-settings.background.clear', ['slot' => $slot]) }}"
                      method="POST" style="display: none;">
                    @csrf
                    @method('DELETE')
                </form>
            @endforeach

        @endif

        @if ($tab === 'theme')
            {{-- ================================================= 4. palettes -- --}}
            <form action="{{ route('admin.site-settings.theme') }}" method="POST">
                @csrf
                <div class="box">
                    <div class="box-header with-border">
                        <h3 class="box-title"><i class="fa fa-paint-brush"></i> Panel theme</h3>
                    </div>
                    <div class="box-body">
                        <p class="help-block">
                            Recolours the <strong>user panel</strong> - dashboard, server pages, console, file
                            manager and the login screens. The AdminLTE admin area you are in keeps its own look, and
                            the change is instant on your next click. Nothing is downloaded and no rebuild is needed.
                        </p>

                        <div class="bs-ss-themes">
                            @foreach ($themes as $slug => $meta)
                                @php $selected = old('theme', $theme) === $slug; @endphp
                                <label class="bs-ss-theme {{ $selected ? 'is-selected' : '' }}" for="theme{{ $slug }}">
                                    <input type="radio" name="theme" id="theme{{ $slug }}" value="{{ $slug }}"
                                           class="bs-ss-theme-input" @if ($selected) checked @endif />
                                    <span class="bs-ss-theme-swatch {{ $meta['dark'] ? 'is-dark' : 'is-light' }}">
                                        @foreach ($meta['swatch'] as $i => $hex)
                                            <i style="background: {{ $hex }}"></i>
            @endforeach

            
                                    </span>
                                    <span class="bs-ss-theme-body">
                                        <span class="bs-ss-theme-name">
                                            {{ $meta['label'] }}
                                            @if ($slug === 'black')
                                                <span class="label label-default bs-ss-theme-tag">shipped</span>
                                            @endif
                                        </span>
                                        <span class="bs-ss-theme-blurb">{{ $meta['blurb'] }}</span>
                                    </span>
                                    <i class="fa fa-check bs-ss-theme-tick"></i>
                                </label>
                            @endforeach
                        </div>
                    </div>
                    <div class="box-footer">
                        <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> Save theme</button>
                    </div>
                </div>
            </form>
        @endif

        @if ($tab === 'links')
            <form action="{{ route('admin.site-settings.links') }}" method="POST">
                @csrf
                <div class="box">
                    <div class="box-header with-border">
                        <h3 class="box-title"><i class="fa fa-link"></i> Quick links</h3>
                    </div>
                    <div class="box-body">
                        <p class="help-block">
                            These appear as buttons on the <strong>login and register</strong> screens, above the form, and
                            as icons in the <strong>dashboard topbar</strong>. Every Home control on the panel - the
                            topbar button, the breadcrumb and the button row - follows the Home link you set here.
                        </p>

                        @foreach ($link_slots as $slot => $meta)
                            @php $link = $links[$slot]; @endphp
                            <div class="bs-ss-field">
                                <div class="checkbox no-margin-bottom">
                                    <input id="{{ $slot }}LinkEnabled" name="{{ $slot }}_enabled" type="checkbox" value="1"
                                           {{ old($slot . '_enabled', $link['enabled']) ? 'checked' : '' }} />
                                    <label for="{{ $slot }}LinkEnabled" class="strong">Show the {{ $meta['label'] }} link</label>
                                </div>
                            </div>

                            <div class="bs-ss-field">
                                <label class="control-label bs-ss-label" for="{{ $slot }}LinkUrl">{{ $meta['label'] }} URL</label>
                                <input type="text" id="{{ $slot }}LinkUrl" name="{{ $slot }}_url" class="form-control"
                                       maxlength="2048" placeholder="https://example.com"
                                       value="{{ old($slot . '_url', $link['url']) }}" />
                                <p class="help-block">
                                    {{ $meta['help'] }}
                                    @if ($slot === 'home')
                                        Site-relative paths such as <code>/</code> are fine too.
                                    @endif
                                </p>
                            </div>

                            <hr>
                        @endforeach
                    </div>
                    <div class="box-footer">
                        <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> Save links</button>
                    </div>
                </div>
            </form>
        @endif
    </div>

    {{-- brine-theme: live previews.

         Deliberately vanilla JS inlined at the end of @section('content'), NOT a
         @section('footer-scripts') block. The layout defines that section with
         @show, which means "use the child's version if it defines one, else use
         this default" - it does not append. Redefining it replaces the block and
         deletes jQuery, Bootstrap and AdminLTE, which is what stopped the page
         scrolling and the mobile sidebar toggle working. Vanilla needs no
         jQuery, so it can run here. --}}
    <script>
        (function () {
            var byId = function (id) {
                return document.getElementById(id);
            };

            // ---- icon preview: file picker and pasted link both feed it ----
            var iconImg = byId('iconPreviewImage');
            var iconFile = byId('siteIcon');
            var iconLink = byId('iconUrl');

            if (iconImg) {
                if (iconFile) {
                    iconFile.addEventListener('change', function () {
                        var file = iconFile.files && iconFile.files[0];
                        if (!file) return;
                        if (iconImg.dataset.objectUrl) URL.revokeObjectURL(iconImg.dataset.objectUrl);
                        iconImg.dataset.objectUrl = URL.createObjectURL(file);
                        iconImg.src = iconImg.dataset.objectUrl;
                    });
                }
                if (iconLink) {
                    // Live only while typing: the server is what finally decides
                    // whether a URL is acceptable, and a rejected one must not be
                    // left looking saved.
                    iconLink.addEventListener('input', function () {
                        var v = iconLink.value.trim();
                        if (/^https?:\/\/\S+\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(v)) {
                            iconImg.src = v;
                        }
                    });
                }
            }

            // ---- background preview + overlay intensity ----
            var applyScrim = function (id, value) {
                var scrim = byId(id);
                if (!scrim) return;
                var pct = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
                scrim.style.background = '#000';
                scrim.style.opacity = String(pct / 100);
                scrim.style.display = '';
            };

            var showPreview = function (imgId, scrimId, emptyId, src) {
                var img = byId(imgId);
                var empty = emptyId ? byId(emptyId) : null;
                if (img) {
                    img.style.display = '';
                    if (src) img.src = src;
                }
                if (empty) empty.style.display = 'none';
                // The scrim starts hidden when no image is saved yet, so it has
                // to come back with the preview - otherwise a fresh upload
                // shows undimmed until the admin happens to move the slider.
                var scrim = byId(scrimId);
                if (scrim) scrim.style.display = '';
            };

            // ---- theme cards: the radio is the control, the card is its face.
            // Only the selected card is outlined; nothing is applied here,
            // because the palettes live in the stylesheet and changing one
            // means a request, not a live repaint of this page.
            var themeCards = document.querySelectorAll('.bs-ss-theme');
            var syncCards = function () {
                Array.prototype.forEach.call(themeCards, function (card) {
                    var input = card.querySelector('.bs-ss-theme-input');
                    card.classList.toggle('is-selected', !!(input && input.checked));
                });
            };
            Array.prototype.forEach.call(themeCards, function (card) {
                var input = card.querySelector('.bs-ss-theme-input');
                if (!input) return;
                input.addEventListener('change', syncCards);
                // Space/enter on a focused card picks it, so the whole card
                // behaves like the control it stands in for.
                card.addEventListener('keydown', function (e) {
                    if (e.key !== ' ' && e.key !== 'Enter') return;
                    e.preventDefault();
                    input.checked = true;
                    syncCards();
                });
            });
            syncCards();

            ['auth', 'dashboard'].forEach(function (slot) {
                var range = byId(slot + 'Intensity');
                var out = byId(slot + 'IntensityOut');
                var scrimId = slot + 'PreviewScrim';
                var imgId = slot + 'PreviewImage';
                var emptyId = slot + 'PreviewEmpty';
                var file = byId(slot + 'File');
                var link = byId(slot + 'Url');

                if (range) {
                    range.addEventListener('input', function () {
                        applyScrim(scrimId, range.value);
                        if (out) out.textContent = range.value + '%';
                    });
                }

                if (file) {
                    file.addEventListener('change', function () {
                        var f = file.files && file.files[0];
                        if (!f) return;
                        // Release the previous pick so a few reloads in a row
                        // do not hold the blobs in memory.
                        if (file.dataset.objectUrl) URL.revokeObjectURL(file.dataset.objectUrl);
                        var url = URL.createObjectURL(f);
                        file.dataset.objectUrl = url;
                        showPreview(imgId, scrimId, emptyId, url);
                        if (link) link.value = '';
                    });
                }

                if (link) {
                    link.addEventListener('input', function () {
                        var v = link.value.trim();
                        if (!/^https?:\/\/\S+$/i.test(v)) return;
                        showPreview(imgId, scrimId, emptyId, v);
                        if (file) file.value = '';
                    });
                }
            });

        })();
    </script>
@endsection
