@extends('layouts.admin')

@section('title', 'Site Settings')

@section('content-header')
    <h1>Site Settings<small>Branding and background images for the user panel.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Site Settings</li>
    </ol>
@endsection

@section('content')
    @php
        $tab = request('tab') === 'background' ? 'background' : 'general';
    @endphp

    <div class="row">
        <div class="col-md-12">
            <div class="box">
                <div class="box-header with-border">
                    {{-- AdminLTE 2 tabs: the `nav-tabs` ul plus a matching `.tab-content`
                         wrapper. Both panes stay in the DOM so switching tabs is instant. --}}
                    <ul class="nav nav-tabs">
                        <li class="{{ $tab === 'general' ? 'active' : '' }}">
                            <a href="{{ route('admin.site-settings', ['tab' => 'general']) }}#general">
                                <i class="fa fa-picture-o"></i> <span>General</span>
                            </a>
                        </li>
                        <li class="{{ $tab === 'background' ? 'active' : '' }}">
                            <a href="{{ route('admin.site-settings', ['tab' => 'background']) }}#background">
                                <i class="fa fa-image"></i> <span>Background</span>
                            </a>
                        </li>
                    </ul>
                </div>

                <div class="box-body">
                    @foreach ($errors->all() as $error)
                        <p class="text-danger">{{ $error }}</p>
                    @endforeach

                    {{-- ------------------------------------------------------------ general -- --}}
                    <div class="tab-content {{ $tab === 'general' ? 'active' : '' }}" id="general">
                        <form action="{{ route('admin.site-settings.general') }}" method="POST" enctype="multipart/form-data">
                            @csrf
                            <div class="row">
                                <div class="col-md-7">
                                    <div class="form-group">
                                        <label class="control-label" for="siteName">Site name</label>
                                        <input type="text" id="siteName" name="name" class="form-control" maxlength="191"
                                               required value="{{ old('name', $name) }}" />
                                        <p class="help-block">
                                            Shown in the browser tab, the sidebar, the login card and the footer. Stored as the
                                            panel&rsquo;s own site name, so everything rebrands at once - nothing is hardcoded.
                                        </p>
                                    </div>
                                </div>

                                <div class="col-md-5">
                                    <div class="box box-solid" style="border-radius: 4px;">
                                        <div class="box-body text-center">
                                            @if ($icon)
                                                <img src="{{ $icon }}" alt="Current icon" style="max-width: 96px; max-height: 96px" />
                                                <p class="text-muted" style="margin-bottom: 0; margin-top: 8px; font-size: 12px;">
                                                    Used as the favicon and the login emblem.
                                                </p>
                                            @else
                                                <img src="/themes/pterodactyl/images/logo.svg" alt="Default emblem" width="80" height="80" />
                                                <p class="text-muted" style="margin-bottom: 0; margin-top: 8px; font-size: 12px;">
                                                    No custom icon - the theme emblem is in use.
                                                </p>
                                            @endif
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label class="control-label" for="siteIcon">Icon</label>
                                <input type="file" id="siteIcon" name="icon" accept=".png,.svg,.jpg,.jpeg,.ico,.gif,.webp" />
                                <p class="help-block">
                                    PNG, SVG, JPG, ICO, GIF or WEBP up to {{ 4096 }} KB. Square artwork looks best - the same
                                    file becomes the favicon, so keep it small. The web server must be able to write to
                                    <code>public/themes/pterodactyl/images/</code>.
                                </p>
                            </div>

                            @if ($icon)
                                <div class="checkbox checkbox-danger no-margin-bottom">
                                    <input id="removeIcon" name="remove_icon" type="checkbox" value="1" />
                                    <label for="removeIcon" class="strong">Remove the custom icon and go back to the default emblem</label>
                                </div>
                            @endif

                            <div class="form-group" style="margin-top: 18px;">
                                <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> Save general</button>
                            </div>
                        </form>
                    </div>

                    {{-- --------------------------------------------------------- background -- --}}
                    <div class="tab-content {{ $tab === 'background' ? 'active' : '' }}" id="background">
                        <p class="help-block">
                            Give the panel a background image. Each area has its own switch, and each takes
                            <strong>either</strong> an uploaded file <strong>or</strong> a direct image link - paste the link and
                            it wins over the file field. The image is dimmed automatically so the dark theme and its text stay readable.
                        </p>

                        <form action="{{ route('admin.site-settings.background') }}" method="POST" enctype="multipart/form-data">
                            @csrf
                            @foreach (['auth' => 'Login & Register', 'dashboard' => 'Dashboard'] as $slot => $label)
                                @php
                                    $slotData = $backgrounds[$slot];
                                @endphp
                                <div class="row">
                                    <div class="col-md-7">
                                        <div class="box">
                                            <div class="box-header with-border">
                                                <h3 class="box-title">{{ $label }}</h3>
                                                <div class="pull-right">
                                                    @if ($slotData['enabled'])
                                                        <span class="label label-success">ON</span>
                                                    @else
                                                        <span class="label label-default">OFF</span>
                                                    @endif
                                                </div>
                                            </div>
                                            <div class="box-body">
                                                <div class="checkbox no-margin-bottom">
                                                    <input id="{{ $slot }}Enabled" name="{{ $slot }}_enabled" type="checkbox" value="1"
                                                           {{ old($slot . '_enabled', $slotData['enabled']) ? 'checked' : '' }} />
                                                    <label for="{{ $slot }}Enabled" class="strong">Show the {{ strtolower($label) }} background</label>
                                                </div>

                                                <div class="form-group" style="margin-top: 14px;">
                                                    <label class="control-label" for="{{ $slot }}Url">Or paste an image link</label>
                                                    <input type="text" id="{{ $slot }}Url" name="{{ $slot }}_url" class="form-control"
                                                           maxlength="2048" placeholder="https://example.com/background.jpg"
                                                           value="{{ old($slot . '_url') }}" />
                                                    <p class="help-block">
                                                        A direct http(s) link ending in .png, .jpg, .jpeg, .gif, .webp or .svg. Leave empty to
                                                        use an uploaded file instead.
                                                    </p>
                                                </div>

                                                <div class="form-group">
                                                    <label class="control-label" for="{{ $slot }}File">Or upload an image</label>
                                                    <input type="file" id="{{ $slot }}File" name="{{ $slot }}_file"
                                                           accept=".png,.jpg,.jpeg,.gif,.webp,.svg" />
                                                    <p class="help-block">Up to 8192 KB. Uploaded into <code>public/themes/pterodactyl/backgrounds/</code>.</p>
                                                </div>

                                                @if ($slotData['image'])
                                                    <div style="border: 1px solid #d2d6de; border-radius: 4px; padding: 8px; background: #19152e;">
                                                        <img src="{{ $slotData['image'] }}" alt="{{ $label }} background preview"
                                                             style="max-width: 100%; max-height: 220px; display: block; margin: 0 auto;" />
                                                    </div>
                                                @endif
                                            </div>
                                            <div class="box-footer">
                                                @if ($slotData['image'])
                                                    <button type="submit" form="clear-{{ $slot }}" class="btn btn-danger btn-sm"
                                                            onclick="return confirm('Remove the {{ strtolower($label) }} background?');">
                                                        <i class="fa fa-trash"></i> Clear {{ strtolower($label) }} background
                                                    </button>
                                                @endif
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            @endforeach

                            <div class="form-group">
                                <button type="submit" class="btn btn-primary"><i class="fa fa-save"></i> Save backgrounds</button>
                            </div>
                        </form>

                        {{-- One DELETE form per slot, kept outside the save form so a
                             nested <form> is never emitted (invalid HTML, and browsers
                             drop the inner one). The button above carries form=. --}}
                        @foreach (['auth', 'dashboard'] as $slot)
                            <form id="clear-{{ $slot }}" action="{{ route('admin.site-settings.background.clear', ['slot' => $slot]) }}"
                                  method="POST" style="display: none;">
                                @csrf
                                @method('DELETE')
                            </form>
                        @endforeach
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        $(function () {
            // AdminLTE tabs, selected from the ?tab= the controller rendered with.
            var tab = '{{ $tab }}' === 'background' ? '#background' : '#general';
            $('.nav-tabs a[href$="#general"], .nav-tabs a[href$="#background"]').parent('li').removeClass('active');
            $('.tab-content').removeClass('active');
            $('.nav-tabs a[href$="' + tab + '"]').tab('show');
        });
    </script>
@endsection
