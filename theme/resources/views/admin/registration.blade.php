@extends('layouts.admin')

@section('title', 'Registration')

@section('content-header')
    <h1>Registration<small>Let visitors create their own panel accounts.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Registration</li>
    </ol>
@endsection

@section('content')
    <div class="row">
        <div class="col-md-7">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Registration module</h3>
                </div>
                <form action="{{ route('admin.registration.update') }}" method="POST">
                    @csrf
                    <div class="box-body">
                        <div class="form-group">
                            {{-- Stock admin checkbox pattern: checkbox.css hides the native input
                                 (opacity: 0) and ticks via `input:checked + label::after`, so the
                                 input and label MUST be siblings, not nested. --}}
                            <div class="checkbox checkbox-primary no-margin-bottom">
                                <input id="pEnableRegistration" name="enabled" type="checkbox" value="1"
                                       {{ old('enabled', $enabled) ? 'checked' : '' }}>
                                <label for="pEnableRegistration" class="strong">
                                    Enable public registration (<code>/auth/register</code>)
                                </label>
                            </div>
                        </div>
                        <p class="help-block">
                            When enabled the login page shows <strong>&ldquo;Don&rsquo;t have an account? Register
                            here&rdquo;</strong> and the sign-up form at <code>/auth/register</code> accepts new users.
                            When disabled the link and the page are hidden and POST requests are refused.
                        </p>

                        <hr>

                        <div class="form-group">
                            <label class="control-label">Application API key</label>
                            <input type="text" name="api_key" class="form-control" autocomplete="off"
                                   placeholder="{{ $keySaved ? 'Saved (' . $keyHint . ') - paste a new key to replace it' : 'Paste the key created under Application API' }}">
                            <p class="help-block">
                                Registration creates users through the panel&rsquo;s own Application API, so this key
                                must be able to read and write <strong>Users</strong>:
                            </p>
                            <ol class="help-block" style="margin-bottom: 0; padding-left: 20px;">
                                <li>Open <a href="{{ route('admin.api.index') }}">Admin &rarr; Application API</a> and
                                    create a new key.</li>
                                <li>Copy the key (it is shown only once) and paste it above.</li>
                                <li>Tick <em>Enable public registration</em> and save.</li>
                            </ol>
                            <p class="help-block" style="margin-top: 8px;">
                                The key is stored server-side in the panel settings and is never sent to browsers.
                            </p>
                            @foreach ($errors->all() as $error)
                                <p class="text-danger">{{ $error }}</p>
                            @endforeach
                        </div>

                        @if ($enabled && ! $keySaved)
                            <div class="alert alert-danger" style="margin-bottom: 0;">
                                Registration is <strong>enabled</strong> but no API key is saved yet - the sign-up form
                                will return an error until you paste one.
                            </div>
                        @endif
                    </div>
                    <div class="box-footer">
                        <button type="submit" class="btn btn-primary">Save settings</button>
                    </div>
                </form>
                @if ($keySaved)
                    <div class="box-footer">
                        <form action="{{ route('admin.registration.destroy') }}" method="POST" style="display: inline;">
                            @csrf
                            @method('DELETE')
                            <button type="submit" class="btn btn-danger"
                                    onclick="return confirm('Remove the saved Application API key?');">Remove API key</button>
                        </form>
                    </div>
                @endif
            </div>
        </div>

        <div class="col-md-5">
            <div class="box">
                <div class="box-header with-border">
                    <h3 class="box-title">Current status</h3>
                </div>
                <div class="box-body">
                    <dl class="dl-horizontal" style="margin-bottom: 0;">
                        <dt>Registration</dt>
                        <dd>
                            @if ($enabled)
                                <span class="label label-success">ENABLED</span>
                            @else
                                <span class="label label-default">DISABLED</span>
                            @endif
                        </dd>
                        <dt>API key</dt>
                        <dd>
                            @if ($keySaved)
                                <code>{{ $keyHint }}</code>
                            @else
                                <span class="text-danger">not set</span>
                            @endif
                        </dd>
                        <dt>Sign-up URL</dt>
                        <dd><code>/auth/register</code></dd>
                    </dl>
                </div>
            </div>
        </div>
    </div>
@endsection
