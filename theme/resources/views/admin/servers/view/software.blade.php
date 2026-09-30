@extends('layouts.admin')

@section('title')
    Server — {{ $server->name }}: Software
@endsection

@section('content-header')
    <h1>{{ $server->name }}<small>Change which software this server runs.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li><a href="{{ route('admin.servers') }}">Servers</a></li>
        <li><a href="{{ route('admin.servers.view', $server->id) }}">{{ $server->name }}</a></li>
        <li class="active">Software</li>
    </ol>
@endsection

@section('content')
@include('admin.servers.partials.navigation')

@php
    /**
     * Group the eggs into same-family and cross-family so the page can say up
     * front which of the two things is about to happen: a safe swap, or a wipe.
     * The family comes from ServerSoftwareService, which is the same code the
     * POST path uses, so what is described here is what actually happens.
     */
    $sameFamily = [];
    $crossFamily = [];
    foreach ($eggsByNest as $nestName => $eggs) {
        foreach ($eggs as $egg) {
            if ((int) $egg->id === (int) $server->egg_id) {
                continue;
            }
            $bucket = \Pterodactyl\Services\ServerSoftwareService::needsReinstall(
                $currentFamily,
                \Pterodactyl\Services\ServerSoftwareService::familyFor($egg),
            ) ? 'cross' : 'same';
            ${$bucket}Family[$nestName][] = $egg;
        }
    }
@endphp

@if ($errors->any())
    <div class="alert alert-danger">
        <ul class="mb-0" style="list-style:none;padding:0;">
            @foreach ($errors->all() as $error)
                <li>{{ $error }}</li>
            @endforeach
        </ul>
    </div>
@endif

<div class="row">
    <div class="col-sm-12">
        <div class="box">
            <div class="box-header with-border">
                <h3 class="box-title">Current software</h3>
            </div>
            <div class="box-body">
                <dl class="dl-horizontal" style="margin:0;">
                    <dt style="width:160px;">Software</dt>
                    <dd style="margin-bottom:6px;">
                        <strong>{{ $server->egg->name }}</strong>
                        <span class="label label-default">{{ $currentFamily }}</span>
                    </dd>
                    <dt>Docker image</dt>
                    <dd style="margin-bottom:6px;"><code>{{ $server->image ?: '—' }}</code></dd>
                    <dt>Startup</dt>
                    <dd style="margin-bottom:0;"><code style="word-break:break-all;">{{ $server->startup }}</code></dd>
                </dl>
            </div>
        </div>
    </div>
</div>

<form action="{{ route('admin.servers.view.software', $server->id) }}" method="POST" id="software-form">
    <div class="row">
        <div class="col-sm-6">
            <div class="box box-success">
                <div class="box-header with-border">
                    <h3 class="box-title">Same family — keeps everything</h3>
                </div>
                <div class="box-body">
                    @if (empty($sameFamily))
                        <p class="text-muted">No other software in this panel is in the same family.</p>
                    @else
                        <p class="text-muted">
                            These lay their files out the same way, so the world, the configuration
                            and any add-ons carry over untouched.
                        </p>
                        @foreach ($sameFamily as $nestName => $eggs)
                            <div class="form-group" style="margin-bottom:10px;">
                                <label class="control-label" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#95a5a6;">{{ $nestName }}</label>
                                @foreach ($eggs as $egg)
                                    <div class="radio" style="margin-bottom:4px;">
                                        <label>
                                            <input type="radio" name="egg_id" value="{{ $egg->id }}" @if (old('egg_id') == $egg->id) checked @endif>
                                            {{ $egg->name }}
                                        </label>
                                    </div>
                                @endforeach
                            </div>
                        @endforeach
                    @endif
                </div>
            </div>
        </div>

        <div class="col-sm-6">
            <div class="box box-danger">
                <div class="box-header with-border">
                    <h3 class="box-title">Different family — reinstalls and wipes</h3>
                </div>
                <div class="box-body">
                    @if (empty($crossFamily))
                        <p class="text-muted">Nothing in this panel would count as a different family.</p>
                    @else
                        <p class="text-muted">
                            These do not share a file layout, so the server is
                            <strong>reinstalled and everything currently on it is lost</strong> —
                            world, configuration, add-ons and all. Take a backup first.
                        </p>
                        @foreach ($crossFamily as $nestName => $eggs)
                            <div class="form-group" style="margin-bottom:10px;">
                                <label class="control-label" style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#95a5a6;">{{ $nestName }}</label>
                                @foreach ($eggs as $egg)
                                    <div class="radio" style="margin-bottom:4px;">
                                        <label>
                                            <input type="radio" name="egg_id" value="{{ $egg->id }}" @if (old('egg_id') == $egg->id) checked @endif>
                                            {{ $egg->name }}
                                        </label>
                                    </div>
                                @endforeach
                            </div>
                        @endforeach
                    @endif
                </div>
            </div>
        </div>
    </div>

    <div class="row">
        <div class="col-sm-12">
            <div class="box box-warning">
                <div class="box-header with-border">
                    <h3 class="box-title">Confirm</h3>
                </div>
                <div class="box-body">
                    <p class="text-muted" id="software-summary">
                        Choose the software to switch to.
                    </p>

                    <div class="checkbox" id="wipe-row" style="display:none;">
                        <label>
                            <input type="checkbox" name="confirm_wipe" value="1" @if (old('confirm_wipe')) checked @endif>
                            I understand this reinstalls the server and <strong>deletes everything on it</strong>.
                        </label>
                    </div>

                    <p class="text-muted" style="font-size:12px;">
                        The server must be stopped. If it is running, the change is refused.
                    </p>

                    <button type="submit" class="btn btn-primary" id="software-submit" disabled>
                        <i class="fa fa-exchange"></i> Change software
                    </button>
                </div>
            </div>
        </div>
    </div>
</form>

@endsection

@push('scripts')
<script>
    // The wipe confirmation is server-rendered state, so the form is submitted
    // without JavaScript: selecting a cross-family option and pressing the button
    // works, and the server rejects it with an explanatory message if the
    // confirmation was not ticked. This only adds the live summary and the
    // enable/disable, it is not what makes the page safe.
    (function () {
        var form = document.getElementById('software-form');
        if (!form) {
            return;
        }

        var names = @json($eggsByNest->flatMap(fn ($eggs) => $eggs)->mapWithKeys(
            fn ($egg) => [(string) $egg->id => $egg->name]
        ));
        var current = @json($server->egg->name);
        // Which targets wipe, recomputed server-side and passed down so this
        // script does not have to duplicate the family rules.
        var wipes = @json(collect($crossFamily)->flatMap(fn ($eggs) => $eggs)->pluck('id')->all());

        var summary = document.getElementById('software-summary');
        var wipeRow = document.getElementById('wipe-row');
        var submit = document.getElementById('software-submit');

        function sync() {
            var picked = form.querySelector('input[name="egg_id"]:checked');
            var wiping = picked && wipes.indexOf(parseInt(picked.value, 10)) !== -1;

            wipeRow.style.display = wiping ? 'block' : 'none';
            submit.disabled = !picked;

            if (picked) {
                summary.innerHTML = wiping
                    ? 'Switch from <strong>' + current + '</strong> to <strong>' + names[picked.value] +
                      '</strong>. This reinstalls the server and deletes everything on it.'
                    : 'Switch from <strong>' + current + '</strong> to <strong>' + names[picked.value] +
                      '</strong>. Files are kept.';
            } else {
                summary.textContent = 'Choose the software to switch to.';
            }
        }

        form.addEventListener('change', function (event) {
            if (event.target.name === 'egg_id') {
                sync();
            }
        });

        sync();
    })();
</script>
@endpush
