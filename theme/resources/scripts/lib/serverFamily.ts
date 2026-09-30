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
