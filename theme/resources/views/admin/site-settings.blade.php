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
    {{-- Everything on one page, stacked. The previous version split this into
         General / Background tabs, but AdminLTE's tab plugin is loaded in
         footer-scripts, i.e. after this markup, so the tab JS had to run from a
         separate block and the second pane was effectively unreachable. One
         column of sections is also the better layout on a phone. --}}
    <style>
        /* Local page styles. Scoped under .bs-site-settings so nothing here can
           leak into the rest of the admin area. */
        .bs-site-settings .bs-ss-preview {
            position: relative;
            overflow: hidden;
            border-radius: 4px;
            background: #19152e;
        }
        .bs-site-settings .bs-ss-preview img {
            display: block;
            width: 100%;
            max-height: 260px;
            object-fit: cover;
        }
        .bs-site-settings .bs-ss-preview .bs-ss-scrim {
            position: absolute;
            inset: 0;
            pointer-events: none;
        }
        /* Live preview of the chosen scrim, driven by the range + colour inputs. */
        .bs-site-settings .bs-ss-swatch {
            display: inline-block;
            width: 34px;
            height: 34px;
            vertical-align: middle;
            border: 1px solid #d2d6de;
            border-radius: 3px;
        }
        .bs-site-settings .bs-ss-output {
            display: inline-block;
            min-width: 3.4em;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
        }
        /* On narrow screens AdminLTE's .col-md-* already stacks; this keeps the
           section header from wrapping badly and makes the controls full width
           so the range input stays usable on a phone. */
        @media (max-width: 767px) {
            .bs-site-settings .box-header .bs-ss-toggle { margin-top: 6px; }
            .bs-site-settings .bs-ss-output { min-width: 0; }
        }
    </style>

    <div class="bs-site-settings">
        @foreach ($errors->all() as $error)
            <div class="alert alert-danger">{{ $error }}</div>
        @endforeach

        {{-- ================================================== identity -- --}}
        <form action="{{ route('admin.site-settings.general') }}" method="POST" enctype="multipart/form-data">
            @csrf
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title"><i class="fa fa-pencil"></i> Name &amp; icon</h3>
                </div>
                <div class="box-body">
                    <div class="row">
                        <div class="col-sm-8">
                            <div class="form-group">
                                <label class="control-label" for="siteName">Site name</label>
                                <input type="text" id="siteName" name="name" class="form-control" maxlength="191" required
                                       value="{{ old('name', $name) }}" />
                                <p class="help-block">
                                    Shown in the browser tab, the sidebar, the topbar, the login card and the footer. Stored as
                                    the panel&rsquo;s own site name, so everything rebrands at once.
                                </p>
                            </div>
                        </div>
                        <div class="col-sm-4">
                            <div class="bs-ss-preview text-center" style="padding: 12px;">
                                @if ($icon)
                                    <img src="{{ $icon }}" alt="Current icon"
                                         style="width: 84px; height: 84px; object-fit: contain;" />
                                    <p class="text-muted" style="margin: 8px 0 0; font-size: 12px;">
                                        Favicon + login emblem
                                    </p>
                                @else
                                    <img src="/themes/pterodactyl/images/logo.svg" alt="Default emblem"
                                         style="width: 84px; height: 84px; object-fit: contain;" />
                                    <p class="text-muted" style="margin: 8px 0 0; font-size: 12px;">
                                        Using the default emblem
                                    </p>
                                @endif
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="control-label" for="siteIcon">Icon</label>
                        <input type="file" id="siteIcon" name="icon" accept=".png,.svg,.jpg,.jpeg,.ico,.gif,.webp" />
                        <p class="help-block">
                            PNG, SVG, JPG, ICO, GIF or WEBP up to 4096 KB. Square artwork looks best - the same file becomes
                            the favicon everywhere. The web server must be able to write to
                            <code>public/themes/pterodactyl/images/</code>.
                        </p>
                    </div>

                    @if ($icon)
                        <div class="checkbox checkbox-danger no-margin-bottom">
                            <input id="removeIcon" name="remove_icon" type="checkbox" value="1" />
                            <label for="removeIcon" class="strong">Remove the custom icon and go back to the default emblem</label>
                        </div>
                    @endif
                </div>
                <div class="box-footer">
                    <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> Save name &amp; icon</button>
                </div>
            </div>
        </form>

        {{-- ================================================ backgrounds -- --}}
        <form action="{{ route('admin.site-settings.background') }}" method="POST" enctype="multipart/form-data">
            @csrf

            @foreach (['auth' => 'Login & Register', 'dashboard' => 'Dashboard'] as $slot => $label)
                @php
                    $slotData = $backgrounds[$slot];
                    $overlay = $slotData['overlay'];
                @endphp
                <div class="box">
                    <div class="box-header with-border">
                        <h3 class="box-title"><i class="fa fa-image"></i> {{ $label }} background</h3>
                        <div class="bs-ss-toggle pull-right">
                            <span class="label {{ $slotData['enabled'] ? 'label-success' : 'label-default' }}">
                                {{ $slotData['enabled'] ? 'ON' : 'OFF' }}
                            </span>
                        </div>
                    </div>
                    <div class="box-body">
                        <div class="checkbox no-margin-bottom">
                            <input id="{{ $slot }}Enabled" name="{{ $slot }}_enabled" type="checkbox" value="1"
                                   {{ old($slot . '_enabled', $slotData['enabled']) ? 'checked' : '' }} />
                            <label for="{{ $slot }}Enabled" class="strong">Show the {{ strtolower($label) }} background</label>
                        </div>

                        <div class="row" style="margin-top: 14px;">
                            <div class="col-sm-6">
                                <div class="form-group">
                                    <label class="control-label" for="{{ $slot }}Url">Image link</label>
                                    <input type="text" id="{{ $slot }}Url" name="{{ $slot }}_url" class="form-control"
                                           maxlength="2048" placeholder="https://example.com/background.jpg"
                                           value="{{ old($slot . '_url') }}" />
                                    <p class="help-block">
                                        A direct http(s) link ending in .png, .jpg, .jpeg, .gif, .webp or .svg. Paste one here
                                        and it is used instead of an uploaded file.
                                    </p>
                                </div>

                                <div class="form-group">
                                    <label class="control-label" for="{{ $slot }}File">Or upload an image</label>
                                    <input type="file" id="{{ $slot }}File" name="{{ $slot }}_file"
                                           accept=".png,.jpg,.jpeg,.gif,.webp,.svg" />
                                    <p class="help-block">Up to 8192 KB, stored in <code>public/themes/pterodactyl/backgrounds/</code>.</p>
                                </div>
                            </div>

                            <div class="col-sm-6">
                                <label class="control-label">Preview</label>
                                @if ($slotData['image'])
                                    <div class="bs-ss-preview">
                                        <img src="{{ $slotData['image'] }}" alt="{{ $label }} background preview" />
                                        <span class="bs-ss-scrim"
                                              style="background: {{ $overlay['colour'] }}; opacity: {{ $overlay['intensity'] / 100 }};"></span>
                                    </div>
                                @else
                                    <p class="text-muted" style="font-size: 12px;">
                                        No image set yet. The preview appears here once you save one.
                                    </p>
                                @endif
                            </div>
                        </div>

                        <hr>

                        {{-- -------------------------------------------------------- overlay -- --}}
                        <h4 style="margin-top: 4px;">Overlay</h4>
                        <p class="help-block">
                            A colour laid over the image so the dark text stays readable. Black at
                            {{ $slot === 'auth' ? '78' : '62' }}% is the default. Turn the intensity down for a dark photo,
                            up for a bright one.
                        </p>

                        <div class="row">
                            <div class="col-sm-6">
                                <div class="form-group">
                                    <label class="control-label" for="{{ $slot }}OverlayIntensity">Intensity</label>
                                    <div class="row">
                                        <div class="col-xs-9">
                                            <input type="range" class="form-control" style="padding: 0; border: 0; background: none;"
                                                   min="0" max="100" step="1"
                                                   id="{{ $slot }}OverlayIntensity"
                                                   name="{{ $slot }}_overlay_intensity"
                                                   value="{{ old($slot . '_overlay_intensity', $overlay['intensity']) }}"
                                                   data-overlay-preview="{{ $slot }}OverlayScrim"
                                                   data-overlay-colour-input="{{ $slot }}OverlayColour" />
                                        </div>
                                        <div class="col-xs-3">
                                            <output class="bs-ss-output" for="{{ $slot }}OverlayIntensity"
                                                    id="{{ $slot }}OverlayOutput">{{ old($slot . '_overlay_intensity', $overlay['intensity']) }}%</output>
                                        </div>
                                    </div>
                                </div>

                                <div class="form-group">
                                    <label class="control-label" for="{{ $slot }}OverlayColour">Colour</label>
                                    <div class="row">
                                        <div class="col-xs-3">
                                            <input type="color" class="form-control" style="padding: 2px; height: 34px;"
                                                   id="{{ $slot }}OverlayColourPicker"
                                                   value="{{ old($slot . '_overlay_colour', $overlay['colour']) }}"
                                                   data-overlay-target="{{ $slot }}OverlayColour" />
                                        </div>
                                        <div class="col-xs-9">
                                            <input type="text" class="form-control" id="{{ $slot }}OverlayColour"
                                                   name="{{ $slot }}_overlay_colour" maxlength="32"
                                                   value="{{ old($slot . '_overlay_colour', $overlay['colour']) }}"
                                                   placeholder="#000000"
                                                   data-overlay-picker="{{ $slot }}OverlayColourPicker"
                                                   data-overlay-preview="{{ $slot }}OverlayScrim"
                                                   data-overlay-output="{{ $slot }}OverlayOutput" />
                                        </div>
                                    </div>
                                    <p class="help-block">A hex value, e.g. <code>#000000</code> or <code>#1b1436</code>.</p>
                                </div>
                            </div>

                            <div class="col-sm-6">
                                <label class="control-label">How it will look</label>
                                <div class="bs-ss-preview">
                                    @if ($slotData['image'])
                                        <img src="{{ $slotData['image'] }}" alt="" />
                                    @else
                                        {{-- No image yet: paint a placeholder so the scrim preview still
                                             demonstrates the setting instead of an empty box. --}}
                                        <div style="height: 150px; background: linear-gradient(135deg, #5b4bc4, #2b87d3);"></div>
                                    @endif
                                    <span class="bs-ss-scrim" id="{{ $slot }}OverlayScrim"
                                          style="background: {{ $overlay['colour'] }}; opacity: {{ $overlay['intensity'] / 100 }};"></span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="box-footer">
                        @if ($slotData['image'])
                            <button type="submit" form="clear-{{ $slot }}" class="btn btn-danger btn-sm"
                                    onclick="return confirm('Remove the {{ strtolower($label) }} background and its overlay?');">
                                <i class="fa fa-trash"></i> Clear
                            </button>
                        @endif
                        <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> Save {{ strtolower($label) }}</button>
                    </div>
                </div>
            @endforeach
        </form>

        {{-- DELETE forms live outside the save form: nested <form> elements are
             invalid HTML and browsers drop the inner one. The buttons above carry
             form="clear-…" to target these. --}}
        @foreach (['auth', 'dashboard'] as $slot)
            <form id="clear-{{ $slot }}" action="{{ route('admin.site-settings.background.clear', ['slot' => $slot]) }}"
                  method="POST" style="display: none;">
                @csrf
                @method('DELETE')
            </form>
        @endforeach
    </div>

    {{-- brine-theme: live overlay preview.

         This is deliberately vanilla JS inlined at the end of @section('content'),
         NOT a @section('footer-scripts') block. The layout defines that section
         with @show, which means "use the child's version if it defines one, else
         use this default" - so redefining it REPLACES the whole block and deletes
         jQuery, Bootstrap and AdminLTE's app.min.js. That is what stopped the
         page scrolling and the mobile sidebar toggle working.

         Vanilla is the right call anyway: it needs no jQuery, so it can run here
         instead of depending on load order. --}}
    <script>
            (function () {
                var apply = function (intensity, colour, scrimId, outputId) {
                    var pct = Math.max(0, Math.min(100, parseInt(intensity, 10) || 0));
                    var scrim = document.getElementById(scrimId);
                    if (!scrim) return;
                    // A bad hex in the free-text field must not blank the preview.
                    var safe = /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(colour) ? colour : '#000000';
                    scrim.style.background = safe.indexOf('#') === 0 ? safe : '#' + safe;
                    scrim.style.opacity = String(pct / 100);
                    var out = document.getElementById(outputId);
                    if (out) out.textContent = pct + '%';
                };

                var bind = function (id, handler) {
                    var el = document.getElementById(id);
                    if (el) el.addEventListener('input', handler);
                };

                ['auth', 'dashboard'].forEach(function (slot) {
                    var range = document.getElementById(slot + 'OverlayIntensity');
                    var text = document.getElementById(slot + 'OverlayColour');
                    var picker = document.getElementById(slot + 'OverlayColourPicker');
                    var scrim = slot + 'OverlayScrim';
                    var output = slot + 'OverlayOutput';

                    bind(slot + 'OverlayIntensity', function () {
                        apply(range.value, text ? text.value : '#000000', scrim, output);
                    });

                    if (text) {
                        bind(slot + 'OverlayColour', function () {
                            // Keep the native picker in step while typing.
                            var v = text.value.trim();
                            if (/^#[0-9a-fA-F]{6}$/.test(v) && picker) picker.value = v.toLowerCase();
                            apply(range ? range.value : 0, v, scrim, output);
                        });
                    }

                    if (picker) {
                        bind(slot + 'OverlayColourPicker', function () {
                            if (text) text.value = picker.value.toLowerCase();
                            apply(range ? range.value : 0, picker.value, scrim, output);
                        });
                    }
                });
            })();
        </script>
@endsection
