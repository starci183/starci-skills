/**
 * The roles of the files of a back-end app (`apps/<app>/src/`, the `be.app.*` slots), read from the slot manifest: the name of a
 * file is the `requires` or `allows` entry of its app slot that it matches, so no rule keeps a path list of its own.
 *
 *   - `main.ts`               the entry: builds the environment source once, parses options and boots the app.
 *   - `app.module.ts`         the composition root: spreads the composition groups and binds the app-wide guards and filter.
 *   - `<app>.env.ts`          the typed, fail-fast environment parsing only; no module composition or business code.
 *   - `<app>.options.ts`      the options types and port bindings (provider maps); no environment reads.
 *   - `compose/<area>.ts`     a composition group: the module list of one area of the app, spread by the root.
 */
import { normalizePath } from "./path.mjs"

/** The composition root of an app. */
const APP_ROOT_ROLE = "app.module.ts"
/** The options of an app. */
export const APP_OPTIONS_ROLE = "<app>.options.ts"
/** The environment parsing of an app. */
export const APP_ENV_ROLE = "<app>.env.ts"
/** A composition group of an app. */
const COMPOSE_GROUP_ROLE = "compose/<area>.ts"

/**
 * The app-slot entry a file matches (`main.ts`, `app.module.ts`, `<app>.env.ts`, `<app>.options.ts`, `compose/<area>.ts`, ...), or null for a
 * file outside the `be.app.*` slots or one its slot does not name.
 *
 * @param {object} hfs - The HFS view of the repository.
 * @param {string} filename - The linted file.
 * @returns {{slot: string, entry: string} | null} The app slot and the entry the file matches.
 */
export const appRoleOf = (hfs, filename) => {
    const file = normalizePath(filename)
    const slot = hfs.slotOf(file) ?? ""
    if (!slot.startsWith("be.app.") || typeof hfs.allows !== "function") return null
    const verdict = hfs.allows(file)
    return verdict?.allowed && verdict.entry ? { slot, entry: verdict.entry } : null
}

/**
 * Whether a file composes the app: its root `app.module.ts` or a composition group `compose/<area>.ts`.
 *
 * @param {object} hfs - The HFS view of the repository.
 * @param {string} filename - The linted file.
 * @returns {boolean} True for a composition file of a back-end app.
 */
export const isAppComposition = (hfs, filename) => {
    const role = appRoleOf(hfs, filename)?.entry
    return role === APP_ROOT_ROLE || role === COMPOSE_GROUP_ROLE
}
