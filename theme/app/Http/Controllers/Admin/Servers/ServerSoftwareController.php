<?php

namespace Pterodactyl\Http\Controllers\Admin\Servers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\ServerSoftwareService;

/**
 * Change a server's software.
 *
 * Root-admin only, but not by a check of our own: the routes live in
 * routes/admin.php, which the panel loads inside `AdminAuthenticate`, and that
 * middleware throws unless `root_admin` is set. A sub-admin with server
 * permissions still cannot reach this.
 *
 * The page lists the panel's own eggs grouped by nest, so it offers whatever the
 * panel actually has - no hardcoded list. Spigot, Velocity and Fabric are not
 * stock Pterodactyl eggs, so they only appear once an admin imports them through
 * Admin -> Nests -> Import egg.
 *
 * The safety rules live in ServerSoftwareService; this stays thin.
 */
class ServerSoftwareController extends Controller
{
    public function __construct(private ServerSoftwareService $service)
    {
    }

    public function index(Server $server): View
    {
        $eggs = Egg::query()->with('nest')->orderBy('name')->get();

        // Group by nest so the picker reads as "Minecraft: Paper, Vanilla…"
        // rather than one flat alphabetical list of fourteen entries.
        $grouped = $eggs->groupBy(fn (Egg $egg) => $egg->nest->name)->sortKeys();

        return view('admin.servers.view.software', [
            'server' => $server,
            'eggsByNest' => $grouped,
            'currentFamily' => ServerSoftwareService::familyFor($server->egg),
            'families' => [
                ServerSoftwareService::FAMILY_BUKKIT,
                ServerSoftwareService::FAMILY_MODLOADER,
                ServerSoftwareService::FAMILY_PROXY,
                ServerSoftwareService::FAMILY_OTHER,
            ],
        ]);
    }

    public function update(Request $request, Server $server): RedirectResponse
    {
        $request->validate([
            'egg_id' => ['required', 'integer', 'exists:eggs,id'],
            // Only consumed for a cross-family switch, where it is required.
            'confirm_wipe' => ['nullable', 'boolean'],
        ]);

        /** @var Egg $target */
        $target = Egg::query()->with('nest')->findOrFail($request->integer('egg_id'));

        try {
            $this->service->switchTo($server, $target, $request->boolean('confirm_wipe'));
        } catch (\RuntimeException $exception) {
            // These are the "you cannot do that right now" cases - server running,
            // confirmation missing, daemon unreachable - and they read as guidance
            // rather than as a fault, so they go back as an error alert instead of
            // a 500.
            return redirect()
                ->route('admin.servers.view.software', $server->id)
                ->with('error', $exception->getMessage());
        }

        return redirect()
            ->route('admin.servers.view.software', $server->id)
            ->with('success', sprintf('Software changed to %s.', $target->name));
    }
}
