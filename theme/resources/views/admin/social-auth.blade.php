@extends('layouts.admin')

@section('title', 'Social Login')

@section('content-header')
    <h1>Social Login<small>Let people sign in with a Google or Discord account.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Social Login</li>
    </ol>
@endsection

@section('content')
    <div class="row">
        <div class="col-md-8">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Providers</h3>
                </div>
                <form action="{{ route('admin.social-auth.update') }}" method="POST">
                    @csrf
                    <div class="box-body">

                        <div class="callout callout-warning">
                            <h4>You need an application with each provider first</h4>
                            <p style="margin-bottom: 8px;">
                                These are OAuth2 <em>client</em> credentials for an application you own. Create one at
                                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>
                                or the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">Discord Developer Portal</a>,
                                then paste the id and secret below and register the callback URL shown for that provider.
                                A callback URL that does not match exactly is the most common reason a provider refuses a sign-in.
                            </p>
                        </div>

                        @foreach ($providers as $key => $provider)
                            <div class="box" style="margin-bottom: 16px;">
                                <div class="box-header with-border" style="background: #f7f7f9;">
                                    <h3 class="box-title" style="font-size: 15px;">
                                        {{ $provider['label'] }}
                                        @if ($provider['usable'])
                                            <span class="label label-success">READY</span>
                                        @elseif ($provider['enabled'])
                                            <span class="label label-warning">NEEDS CREDENTIALS</span>
                                        @else
                                            <span class="label label-default">DISABLED</span>
                                        @endif
                                    </h3>
                                </div>
                                <div class="box-body">
                                    <div class="form-group no-margin-bottom">
                                        {{-- Stock admin checkbox pattern: checkbox.css hides the native input
                                             (opacity: 0) and ticks via `input:checked + label::after`, so the
                                             input and label MUST be siblings, not nested. --}}
                                        <div class="checkbox checkbox-primary no-margin-bottom">
                                            <input id="pEnable{{ ucfirst($key) }}" name="{{ $key }}[enabled]" type="checkbox" value="1"
                                                   {{ old($key . '.enabled', $provider['enabled']) ? 'checked' : '' }}>
                                            <label for="pEnable{{ ucfirst($key) }}" class="strong">
                                                Enable {{ $provider['label'] }} sign-in
                                            </label>
                                        </div>
                                    </div>

                                    <div class="form-group">
                                        <label for="p{{ ucfirst($key) }}ClientId">Client ID</label>
                                        <input type="text" id="p{{ ucfirst($key) }}ClientId" name="{{ $key }}[client_id]"
                                               class="form-control" value="{{ old($key . '.client_id', $provider['client_id']) }}"
                                               placeholder="{{ $provider['client_id'] !== '' ? 'Saved - leave blank to keep' : 'Paste the client id' }}" autocomplete="off">
                                        <p class="help-block">Not a secret. Shown back to you so you can confirm you are editing the right application.</p>
                                    </div>

                                    <div class="form-group">
                                        <label for="p{{ ucfirst($key) }}Secret">Client secret</label>
                                        <input type="password" id="p{{ ucfirst($key) }}Secret" name="{{ $key }}[client_secret]"
                                               class="form-control" value="" autocomplete="new-password"
                                               placeholder="{{ $provider['has_secret'] ? 'Saved - leave blank to keep' : 'Paste the client secret' }}">
                                        <p class="help-block">
                                            Encrypted before it is stored and never shown again. Leave it blank to keep the
                                            current one.
                                            @if ($provider['has_secret'])
                                                <a href="#" onclick="document.getElementById('p{{ ucfirst($key) }}ClearSecret').submit(); return false;">
                                                    Remove the saved secret
                                                </a>
                                            @endif
                                        </p>
                                    </div>

                                    <div class="form-group no-margin-bottom">
                                        <label>Callback URL</label>
                                        <p class="help-block" style="margin-bottom: 0;">
                                            Register this exact value with {{ $provider['label'] }}:
                                        </p>
                                        <div class="input-group">
                                            <input type="text" id="p{{ ucfirst($key) }}Callback" class="form-control" readonly
                                                   value="{{ $provider['callback'] }}" style="font-family: monospace;">
                                            <span class="input-group-btn">
                                                <button type="button" class="btn btn-default" title="Copy callback URL"
                                                        onclick="navigator.clipboard.writeText(document.getElementById('p{{ ucfirst($key) }}Callback').value); this.blur();">
                                                    <i class="fa fa-copy"></i>
                                                </button>
                                            </span>
                                        </div>
                                        <p class="help-block" style="margin-bottom: 0;">
                                            Scopes requested: <code>{{ $provider['scopes'] }}</code>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        @endforeach

                        <p class="help-block">
                            A provider that is switched on but has no client id and secret shows as
                            <span class="label label-warning">NEEDS CREDENTIALS</span> and renders no button on the login
                            screen. You can save the switch before you have the credentials - useful when you are setting
                            the application up in another tab.
                        </p>
                    </div>
                    <div class="box-footer">
                        <button type="submit" class="btn btn-primary">Save settings</button>
                    </div>
                </form>

                {{-- The clear-secret forms live outside the save form: a form cannot
                     nest inside another, and each one carries only its own provider. --}}
                @foreach ($providers as $key => $provider)
                    @if ($provider['has_secret'])
                        <form id="p{{ ucfirst($key) }}ClearSecret" action="{{ route('admin.social-auth.clear-secret', ['provider' => $key]) }}" method="POST" style="display: none;">
                            @csrf
                        </form>
                    @endif
                @endforeach
            </div>
        </div>

        <div class="col-md-4">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">How it behaves</h3>
                </div>
                <div class="box-body">
                    <dl class="dl-horizontal" style="margin-bottom: 0;">
                        @foreach ($providers as $key => $provider)
                            <dt>{{ $provider['label'] }}</dt>
                            <dd>
                                @if ($provider['usable'])
                                    <span class="label label-success">ENABLED</span>
                                @elseif ($provider['enabled'])
                                    <span class="label label-warning">ON, NOT READY</span>
                                @else
                                    <span class="label label-default">OFF</span>
                                @endif
                            </dd>
                        @endforeach

                        <dt>New accounts</dt>
                        <dd>
                            @if ($registration_enabled)
                                <span class="label label-success">ALLOWED</span>
                            @else
                                <span class="label label-default">BLOCKED</span>
                            @endif
                        </dd>

                        <dt>No dependency</dt>
                        <dd>Built in, no Composer package</dd>
                    </dl>

                    <hr>

                    <h4>How a sign-in is matched</h4>
                    <p class="help-block">
                        The provider's address must be <strong>verified</strong> by the provider, and it is matched
                        against your existing users by email. A match signs straight in.
                    </p>
                    <p class="help-block">
                        An address with no account is created as a new user - but only while
                        <a href="{{ route('admin.registration') }}">Registration</a> is on. With registration off, social
                        sign-in still works for people who already have an account; it just will not create new ones.
                        That way a closed panel is genuinely closed.
                    </p>

                    <h4>Accounts with 2FA</h4>
                    <p class="help-block" style="margin-bottom: 0;">
                        Refused. A social sign-in cannot produce the panel's two-factor checkpoint, so those users are sent
                        to the normal password form rather than being signed in around a factor they enabled themselves.
                    </p>
                </div>
            </div>
        </div>
    </div>
@endsection
