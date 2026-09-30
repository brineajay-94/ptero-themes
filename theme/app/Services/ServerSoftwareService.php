<?php

namespace Pterodactyl\Services;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\EggVariable;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerVariable;
use Pterodactyl\Repositories\Wings\DaemonServerRepository;
use Pterodactyl\Services\Servers\ReinstallServerService;

/**
 * Switching a server's software (its egg).
 *
 * This panel has no egg switching at all. `Admin\ServersController::updateBuild`
 * accepts only allocations and limits, `BuildModificationService` handles no
 * `egg_id` or `image`, and the admin build view never mentions an egg - so there
 * is nothing to re-enable and this is written from scratch. It is also the only
 * part of the theme that lives in the admin area, deliberately: egg changes are
 * root-admin-only in stock Pterodactyl, and a user-facing switcher would be a
 * privilege escalation with a data-destruction button attached. The routes live
 * in routes/admin.php, which the panel loads inside
 * `['auth.session', 2FA, AdminAuthenticate]` - and `AdminAuthenticate` throws
 * unless `root_admin` is set, so the gate is the panel's own, not ours.
 *
 * What a switch actually has to do, on this schema:
 *
 *   servers.egg_id      the new egg
 *   servers.image       the new egg's docker image
 *   servers.startup     the new egg's startup command
 *   server_variables    rebuilt from the new egg's variables
 *
 * Two things differ from stock Pterodactyl and are easy to get wrong:
 *
 *   - the column is `eggs.startup`, not `eggs.start`
 *   - there is no `eggs.docker_image`; this is a Blueprint panel and the column
 *     is `eggs.docker_images`, a JSON map of {label: image} offering several
 *     Java versions per egg. `resolveImage()` picks the closest match to what the
 *     server is already on, so a Paper -> Spigot switch keeps Java 21 rather
 *     than silently dropping the server to whatever is listed first.
 *
 * The live power state is read from the daemon, not the database: `servers.status`
 * records installing/suspended but never running, so a database check would let
 * the switch happen on a live server. If the daemon cannot be reached the check
 * fails closed.
 */
class ServerSoftwareService
{
    public function __construct(
        private DaemonServerRepository $daemon,
        private ReinstallServerService $reinstall,
    ) {
    }

    /**
     * Software families, which decide whether a switch needs a reinstall.
     *
     * Same-family means the two eggs lay their files out the same way, so
     * switching keeps the world, the config and any add-ons. Cross-family means
     * at least one of those is meaningless to the target - Paper's `plugins/` and
     * world format are not Fabric's - and a reinstall is the honest answer.
     */
    public const FAMILY_BUKKIT = 'bukkit';
    public const FAMILY_MODLOADER = 'modloader';
    public const FAMILY_PROXY = 'proxy';
    public const FAMILY_OTHER = 'other';

    /**
     * The family an egg belongs to.
     *
     * Server-side this can read the egg's name directly, which is why it does
     * not use the variable-name heuristic in `lib/serverFamily.ts` - that one
     * exists only because the client is never told the egg's name. The two must
     * agree, or the nav item and this page would disagree about what a server is.
     */
    public static function familyFor(Egg $egg): string
    {
        $name = strtolower($egg->name);

        // Spigot/Purpur/Bukkit/Paper are all Bukkit forks. Fabric and its
        // forks load from mods/.
        foreach (['paper', 'spigot', 'purpur', 'bukkit'] as $needle) {
            if (str_contains($name, $needle)) {
                return self::FAMILY_BUKKIT;
            }
        }
        foreach (['forge', 'fabric', 'quilt', 'neoforge', 'modded'] as $needle) {
            if (str_contains($name, $needle)) {
                return self::FAMILY_MODLOADER;
            }
        }
        foreach (['bungee', 'velocity', 'waterfall'] as $needle) {
            if (str_contains($name, $needle)) {
                return self::FAMILY_PROXY;
            }
        }

        return self::FAMILY_OTHER;
    }

    /**
     * Whether moving between two families needs the server reinstalled.
     *
     * Anything to do with `other` counts as cross-family even when both sides
     * are `other`: vanilla -> CS2 shares no file layout, and there is nothing
     * about two unrelated Source games that makes that safe either.
     */
    public static function needsReinstall(string $from, string $to): bool
    {
        if ($from === self::FAMILY_OTHER || $to === self::FAMILY_OTHER) {
            return true;
        }

        return $from !== $to;
    }

    /**
     * Pick the image for the target egg, preferring the Java version the server
     * is already running.
     *
     * Blueprint stores {label: image}, so "Java 21" is as good a match as the
     * bare image name. Matching on the label is what keeps a Paper -> Spigot
     * switch on the same Java rather than resetting it.
     */
    public static function resolveImage(array $dockerImages, ?string $currentImage): string
    {
        if (empty($dockerImages)) {
            // Nothing to choose from: keep what the server is on rather than
            // blanking it, which would make the server unschedulable.
            return (string) $currentImage;
        }

        $current = (string) $currentImage;
        $best = null;
        $bestRank = -1;

        foreach ($dockerImages as $label => $image) {
            $rank = 0;

            // Exact image match is always best.
            if ($image === $current) {
                $rank = 3;
            } elseif (stripos((string) $label, basename($current)) !== false) {
                $rank = 2;
            } elseif (preg_match('/(\d+)/', (string) $label, $m) && str_contains($current, 'java_' . $m[1])) {
                $rank = 1;
            }

            if ($rank > $bestRank) {
                $bestRank = $rank;
                $best = $image;
            }
        }

        return (string) ($best ?? reset($dockerImages));
    }

    /**
     * Refuse while the server is live.
     *
     * The database does not know whether a server is running, so this asks the
     * daemon. An unreachable daemon fails closed: a switch that cannot confirm
     * the server is stopped is not a switch to attempt.
     *
     * @throws \RuntimeException when the server is not safe to switch
     */
    public function assertSwitchable(Server $server): void
    {
        if (!$server->isInstalled() || !$server->canBeReinstalled()) {
            throw new \RuntimeException('This server is not in a state where its software can be changed.');
        }

        try {
            $details = $this->daemon->setServer($server)->getDetails();
        } catch (DaemonConnectionException $exception) {
            throw new \RuntimeException(
                'Could not reach the node to confirm the server is stopped. Change it from the server instead.'
            );
        }

        $state = $details['state'] ?? null;
        if ($state !== 'offline') {
            throw new \RuntimeException('Stop the server before changing its software.');
        }
    }

    /**
     * Perform the switch.
     *
     * @param bool $confirmed the admin ticked "this will wipe the server" - only
     *                        meaningful, and only required, for a cross-family switch
     *
     * @throws \RuntimeException
     */
    public function switchTo(Server $server, Egg $target, bool $confirmed): void
    {
        if ((int) $server->egg_id === (int) $target->id) {
            throw new \RuntimeException('That is already this server\'s software.');
        }

        $this->assertSwitchable($server);

        $from = self::familyFor($server->egg);
        $to = self::familyFor($target);
        $reinstall = self::needsReinstall($from, $to);

        if ($reinstall && !$confirmed) {
            throw new \RuntimeException(sprintf(
                'Switching from %s to %s changes the file layout, so the server has to be reinstalled and everything on it is lost. Tick the confirmation to continue.',
                $server->egg->name,
                $target->name
            ));
        }

        DB::transaction(function () use ($server, $target, $reinstall) {
            $previousStartup = (string) $server->startup;
            $eggDefaultStartup = (string) $server->egg->startup;

            $server->egg_id = $target->id;
            $server->image = self::resolveImage((array) $target->docker_images, $server->image);

            // A customised startup is the admin's own command, so it is only
            // replaced when it is still the old egg's default - which is the case
            // for a server that has never had its startup edited.
            $server->startup = $previousStartup === $eggDefaultStartup
                ? (string) $target->startup
                : $previousStartup;

            $server->save();

            $this->rebuildVariables($server, $target);

            $this->daemon->setServer($server)->sync();
        });

        if ($reinstall) {
            $this->reinstall->handle($server);
        }
    }

    /**
     * Rebuild the server's variables from the target egg.
     *
     * Values are carried over wherever the same env_variable exists on both
     * eggs, so a switch does not silently reset something the admin configured -
     * most visibly SERVER_JARFILE and the Minecraft version, which are set the
     * same way on every Minecraft egg.
     */
    private function rebuildVariables(Server $server, Egg $target): void
    {
        // Server::variables() is a hasMany(EggVariable) LEFT JOINed against
        // server_variables, which aliases the per-server override onto the egg
        // variable as `server_value` - the model has no `variable` relation and no
        // `variable_value` attribute. This is the same shape EnvironmentService
        // reads, and using anything else silently carries nothing over, quietly
        // resetting the admin's configuration on every switch.
        //
        // Read it LAZILY. `Server::with('variables')` hydrates the aliased
        // `server_value` as NULL while the lazy path returns it, so an
        // eager-loaded read makes every override look unset. The generated SQL is
        // identical either way - only the hydration differs. EnvironmentService
        // reads lazily and the panel is unaffected, but anything that eager-loads
        // this relation will see the wrong thing.
        $existing = $server->variables->keyBy(fn (EggVariable $variable) => $variable->env_variable);

        ServerVariable::query()->where('server_id', $server->id)->delete();

        $records = [];
        foreach ($target->variables as $variable) {
            $records[] = [
                'server_id' => $server->id,
                'variable_id' => $variable->id,
                // Carry the value over when this variable exists on both eggs -
                // SERVER_JARFILE and the Minecraft version are configured the
                // same way on every Minecraft egg, and resetting them would
                // silently change how the server starts. Empty means "use the
                // egg default", which EnvironmentService already handles.
                //
                // The column here IS `variable_value`, which is what the model's
                // docblock says but which ServerCreationService::storeEggVariables
                // gets wrong: it inserts the key `server_value`, which is not a
                // column in this table.
                'variable_value' => $existing->get($variable->env_variable)?->server_value ?? '',
            ];
        }

        if (!empty($records)) {
            ServerVariable::query()->insert($records);
        }
    }
}
