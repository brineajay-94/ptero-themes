import type { JarKind } from '@/api/server/jars';

/**
 * Which flavour of jar server this is, from its egg variables.
 *
 * The panel does not expose the egg *name* to the client: `ServerController::index`
 * never calls `parseIncludes()`, so `?include=egg` is silently ignored, and
 * `egg_features` is identical across the Minecraft eggs
 * (`["eula","java_version","pid_limit"]` on every one of them). `docker_image` is
 * the shared java image, not the game.
 *
 * What *is* available is the egg's variables, and they are a reliable
 * fingerprint: `EggVariableTransformer` throws on anything that is not
 * `user_viewable`, so only the variables an admin chose to expose reach the
 * browser at all. Their *names* differ per family even where their values are
 * all "latest":
 *
 *   Paper / Spigot / Purpur   MINECRAFT_VERSION, BUILD_NUMBER
 *   Forge                     MC_VERSION, FORGE_VERSION, BUILD_TYPE
 *   Fabric / Quilt / NeoForge usually MINECRAFT_VERSION, sometimes a loader var
 *   Vanilla                   VANILLA_VERSION
 *   Bungeecord                BUNGEE_VERSION
 *   Sponge                    SPONGE_VERSION
 *   Source Engine             SRCDS_APPID
 *   TeamSpeak                 TS_VERSION
 *   Rust                      FRAMEWORK
 *
 * So this reads variable *names*, not values.
 *
 * It is a pre-filter, not the final answer. A Fabric egg that reuses
 * MINECRAFT_VERSION is indistinguishable from Paper here, which is why the
 * sidebar still probes the filesystem - see `hasJarDirectory`. The order below
 * matters: FORGE_VERSION is unambiguous and is checked before the Bukkit names,
 * so a Forge egg that also carries MINECRAFT_VERSION is still classified as
 * Forge.
 */

export type ServerGame = 'minecraft' | 'other';

/** Variable names that mean "not a Minecraft server". */
const NON_MINECRAFT = [
    'SRCDS_APPID', // Source Engine: TF2, CS2, Garry's Mod, ARK, Insurgency
    'TS_VERSION', // TeamSpeak 3
    'FRAMEWORK', // Rust (vanilla / oxide / carbon)
    'BUNGEE_VERSION', // proxy, not a game server
    'SPONGE_VERSION',
];

/** Unambiguous mod-loader markers, checked before the Bukkit ones. */
const MODLOADER = ['FORGE_VERSION', 'FABRIC_VERSION', 'QUILT_VERSION', 'NEOFORGE_VERSION', 'MODLOADER'];

/** Bukkit-family markers. */
const BUKKIT = ['MINECRAFT_VERSION', 'BUILD_NUMBER'];

export const isMinecraftEgg = (
    variables: { envVariable: string }[] = []
): ServerGame => {
    const names = variables.map((variable) => (variable.envVariable || '').toUpperCase());

    if (names.some((name) => NON_MINECRAFT.includes(name))) {
        return 'other';
    }

    if (names.includes('VANILLA_VERSION')) {
        // Vanilla is a Minecraft server, it just has nothing to install. It is
        // reported as 'minecraft' so the caller can still probe and find neither
        // directory, which is what keeps the nav item hidden.
        return 'minecraft';
    }

    return 'minecraft';
};

/**
 * The jar kinds worth probing for, given the egg.
 *
 * Only the families that can actually hold jars are returned, so a TeamSpeak or
 * Rust server costs zero requests. A Rust server is deliberately excluded even
 * though its FRAMEWORK variable marks it as modded: Modrinth hosts no Rust mods,
 * so a Mods page there would only ever come up empty.
 */
export const candidateJarKinds = (
    variables: { envVariable: string }[] = []
): JarKind[] => {
    if (isMinecraftEgg(variables) === 'other') {
        return [];
    }

    const names = variables.map((variable) => (variable.envVariable || '').toUpperCase());

    if (names.some((name) => MODLOADER.includes(name))) {
        return ['mods'];
    }

    // Bukkit or Vanilla or a Fabric egg reusing MINECRAFT_VERSION: probe both and
    // let the filesystem decide.
    return ['plugins', 'mods'];
};

/**
 * A label for what KIND of server this is, or null when the variables say
 * nothing at all.
 *
 * WHY A FAMILY AND NOT THE EGG NAME
 * ---------------------------------
 * The egg name is not available to the browser on this endpoint - see the
 * docblock above - so anything claiming to name the egg is either a guess or a
 * lie. Guessing is worse than not answering: Paper, Spigot and Purpur all carry
 * MINECRAFT_VERSION and BUILD_NUMBER, so a Paper server and a Spigot server are
 * indistinguishable from the client, and "Paper" would be wrong on one of them.
 * "Bukkit" is right on both.
 *
 * The same reasoning killed an earlier version of the dashboard card, which
 * printed "No egg assigned" whenever `server.egg` / `server.eggName` were
 * undefined - and the panel never sends either, so EVERY server showed it, Paper
 * servers included. A field the client cannot see is not a missing egg.
 *
 * Null means genuinely unknown, and it is a real case: `includeVariables()`
 * returns a null resource for a subuser without ACTION_STARTUP_READ, so their
 * variables relationship is absent rather than empty. Callers fall back to the
 * node name, which the transformer always sends.
 */
export const serverFamilyLabel = (variables: { envVariable: string }[] = []): string | null => {
    const names = variables.map((variable) => (variable.envVariable || '').toUpperCase());
    const has = (...candidates: string[]) => candidates.some((candidate) => names.includes(candidate));

    // Ordered most specific first, and every branch is a variable name the panel
    // itself documents - so a hit means something, rather than being a default.
    if (has('SRCDS_APPID')) return 'Source Engine';
    if (has('TS_VERSION')) return 'TeamSpeak';
    if (has('FRAMEWORK')) return 'Rust';
    if (has('BUNGEE_VERSION')) return 'Bungeecord';
    if (has('SPONGE_VERSION')) return 'Sponge';

    if (has('FORGE_VERSION')) return 'Forge';
    if (has('FABRIC_VERSION')) return 'Fabric';
    if (has('QUILT_VERSION')) return 'Quilt';
    if (has('NEOFORGE_VERSION')) return 'NeoForge';
    // A bare MODLOADER says something is modded without saying what, so it gets a
    // label that admits that instead of being folded into "Minecraft".
    if (has('MODLOADER')) return 'Modded';

    if (has('VANILLA_VERSION')) return 'Vanilla';

    // The Bukkit family. Deliberately not "Paper": Spigot and Purpur are
    // indistinguishable here and would be mislabelled.
    if (has('MINECRAFT_VERSION', 'BUILD_NUMBER')) return 'Bukkit';

    return null;
};

/** The variable shape this module needs, widened from the panel's own type. */
interface VersionVariable {
    envVariable: string;
    serverValue?: string | null;
    defaultValue?: string | null;
}

/**
 * Variable names worth showing as "the version", most specific first.
 *
 * BUILD_NUMBER leads because it is the one that reads like a version - a Paper
 * egg's is "74" - where MINECRAFT_VERSION is the game version the egg was
 * configured against and is very often left blank. A blank value is skipped
 * rather than rendered as an empty string, which is why this is a preference
 * LIST and not a single lookup.
 */
const VERSION_PREFERENCE = [
    'BUILD_NUMBER',
    'MINECRAFT_VERSION',
    'VANILLA_VERSION',
    'BUNGEE_VERSION',
    'FORGE_VERSION',
    'FABRIC_VERSION',
    'QUILT_VERSION',
    'NEOFORGE_VERSION',
    'TS_VERSION',
    'FRAMEWORK',
    'SRCDS_APPID',
];

/**
 * The version this server reports, or null when no variable carries one.
 *
 * Reads `serverValue` first and falls back to `defaultValue`, which is how the
 * panel itself resolves a variable: a server that never had the variable
 * changed still has the egg's default, and showing nothing for those would be
 * wrong rather than cautious.
 *
 * Only user_viewable variables reach the browser at all
 * (`includeVariables()` filters on it), so this cannot show a value the user is
 * not allowed to see - and equally, an egg whose only version-ish variables are
 * hidden will return null, which callers must handle rather than print.
 */
export const serverVersionLabel = (variables: VersionVariable[] = []): string | null => {
    const values = new Map<string, string>();

    for (const variable of variables) {
        const key = (variable.envVariable || '').toUpperCase();
        const value = (variable.serverValue ?? variable.defaultValue ?? '').trim();

        if (key && value) {
            values.set(key, value);
        }
    }

    for (const name of VERSION_PREFERENCE) {
        const found = values.get(name);

        if (found) {
            return found;
        }
    }

    return null;
};
