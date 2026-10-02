{{-- brine-theme: @php/@endphp, NOT a raw <?php ... ?> block.

     The stock partial uses the raw form. This one used to open with `<?php` and
     close with `@endphp`, which mixes two different conventions and does not
     work: Blade only rewrites `@php ... @endphp` as a PAIR, so a lone `@endphp`
     survives into the compiled view verbatim. The raw `<?php` on line one is left
     alone by Blade and really does open a PHP block, which then runs on through
     the untouched `@endphp` and into the markup below it - so the compiled view
     was `<?php ... @endphp <div class="row">`, and PHP died on the `class`
     attribute with "syntax error, unexpected token \"class\"".

     Every view under /admin/servers/view went down with it, because
     admin/servers/view/index.blade.php includes this partial. Same reason the
     other theme Blade files use the @php pair.

     Do not "restore" the stock raw form without also replacing the @endphp. --}}
@php
    /** @var \Pterodactyl\Models\Server $server */
    $router = app('router');
@endphp
<div class="row">
    <div class="col-xs-12">
        <div class="nav-tabs-custom nav-tabs-floating">
            <ul class="nav nav-tabs">
                <li class="{{ $router->currentRouteNamed('admin.servers.view') ? 'active' : '' }}">
                    <a href="{{ route('admin.servers.view', $server->id) }}">About</a></li>
                @if($server->isInstalled())
                    <li class="{{ $router->currentRouteNamed('admin.servers.view.details') ? 'active' : '' }}">
                        <a href="{{ route('admin.servers.view.details', $server->id) }}">Details</a>
                    </li>
                    <li class="{{ $router->currentRouteNamed('admin.servers.view.build') ? 'active' : '' }}">
                        <a href="{{ route('admin.servers.view.build', $server->id) }}">Build Configuration</a>
                    </li>
                    <li class="{{ $router->currentRouteNamed('admin.servers.view.startup') ? 'active' : '' }}">
                        <a href="{{ route('admin.servers.view.startup', $server->id) }}">Startup</a>
                    </li>
                    {{-- The theme's own tab. This panel has no egg switching anywhere:
                         updateBuild takes only allocations and limits, so software is
                         changed from here instead. --}}
                    <li class="{{ $router->currentRouteNamed('admin.servers.view.software') ? 'active' : '' }}">
                        <a href="{{ route('admin.servers.view.software', $server->id) }}">Software</a>
                    </li>
                    <li class="{{ $router->currentRouteNamed('admin.servers.view.database') ? 'active' : '' }}">
                        <a href="{{ route('admin.servers.view.database', $server->id) }}">Database</a>
                    </li>
                    <li class="{{ $router->currentRouteNamed('admin.servers.view.mounts') ? 'active' : '' }}">
                        <a href="{{ route('admin.servers.view.mounts', $server->id) }}">Mounts</a>
                    </li>
                @endif
                <li class="{{ $router->currentRouteNamed('admin.servers.view.manage') ? 'active' : '' }}">
                    <a href="{{ route('admin.servers.view.manage', $server->id) }}">Manage</a>
                </li>
                <li class="tab-danger {{ $router->currentRouteNamed('admin.servers.view.delete') ? 'active' : '' }}">
                    <a href="{{ route('admin.servers.view.delete', $server->id) }}">Delete</a>
                </li>
                <li class="tab-success">
                    <a href="/server/{{ $server->uuidShort }}" target="_blank"><i class="fa fa-external-link"></i></a>
                </li>
            </ul>
        </div>
    </div>
</div>
