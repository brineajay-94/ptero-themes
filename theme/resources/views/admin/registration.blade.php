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

                        <p class="help-block" style="margin-bottom: 0;">
                            Accounts are created <strong>directly by the panel itself</strong> - the same service the
                            Admin &rarr; Users page uses. The password is hashed server-side, the account gets a
                            welcome e-mail, and no API key or extra configuration is required.
                        </p>
                    </div>
                    <div class="box-footer">
                        <button type="submit" class="btn btn-primary">Save settings</button>
                    </div>
                </form>
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
                        <dt>Sign-up URL</dt>
                        <dd><code>/auth/register</code></dd>
                        <dt>Account creation</dt>
                        <dd>Direct (panel user service)</dd>
                    </dl>
                </div>
            </div>
        </div>
    </div>
@endsection
