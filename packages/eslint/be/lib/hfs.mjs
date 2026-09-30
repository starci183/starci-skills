/**
 * The one door between the lint rules and the HFS slot manifest of the repository being linted.
 *
 * A consuming `eslint.config.mjs` is the one line `export default starciBeConfig({ hfs: loadHfs(import.meta.url) })`.
 * The config lives in the be/ side folder of an app; `loadHfs` finds the app-root `hfs.json` one level up and gives every file
 * linted under that folder the view of the be side (paths relative to be/), with the slot manifest this package ships in
 * `runtime/` (a byte copy of the runtime's `knowledge/hfs/slots.yaml`, `scripts/lib/hfs-slots.mjs` and `scripts/lib/hfs-view.mjs`, refreshed by
 * `packages/hfs/scripts/sync-runtime.mjs`), and returns an object the factory puts in `settings.starci.hfs`.
 *
 * Every path-scoped rule asks `slotOf` here instead of testing a path with a regular expression: a rule never assumes
 * `/src/modules/` or `/src/tests/`. A rule that needs the manifest and finds no `settings.starci.hfs` stops the lint run
 * with an error naming the fix, because a rule must not guess.
 */
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { declaredHfsView, openHfsView } from "../runtime/scripts/lib/hfs-view.mjs"

const RUNTIME = join(dirname(fileURLToPath(import.meta.url)), "..", "runtime")

/**
 * The HFS view of the side whose `eslint.config.mjs` (in be/) calls this.
 *
 * @param {string} configUrl - `import.meta.url` of the repository's `eslint.config.mjs`.
 * @returns {object} The frozen HFS view (profile, apps, connections, ruleParams, slotOf, tierOf, ownerOf).
 */
export const loadHfs = (configUrl) => openHfsView({ runtimeRoot: RUNTIME, repoRoot: dirname(fileURLToPath(configUrl)) })

/**
 * The HFS view of the be side of an in-memory app declaration, for rule tests: no file is read except the shipped manifest.
 *
 * @param {object} declaration - An app `hfs.json` object.
 * @param {string} repoRoot - The absolute be side folder the linted filenames live under.
 * @returns {object} The frozen HFS view.
 */
export const hfsFromDeclaration = (declaration, repoRoot) => declaredHfsView({ runtimeRoot: RUNTIME, declaration, repoRoot, side: "be" })

/**
 * The HFS view a rule runs under; a rule that needs it and gets none refuses to guess.
 *
 * @param {object} context - The ESLint rule context.
 * @returns {object} The HFS view from `settings.starci.hfs`.
 */
export const hfsOf = (context) => {
    const hfs = context.settings?.starci?.hfs
    if (!hfs || typeof hfs.slotOf !== "function") {
        throw new Error(`${context.id ?? "a starci-be rule"} needs settings.starci.hfs: lint through starciBeConfig({ hfs: loadHfs(import.meta.url) })`)
    }
    return hfs
}

/**
 * Whether a file belongs to the test world: the slot `be.tests.world` or one of its sub-slots (`be.tests.world.kit`, the world's
 * inlined helpers). The world and its helpers form one test composition root.
 *
 * @param {object} hfs - The HFS view of the repository.
 * @param {string} file - A file path.
 * @returns {boolean} True for a file of the test world family.
 */
export const inTestWorld = (hfs, file) => {
    const slot = hfs.slotOf(file)
    return slot === "be.tests.world" || (typeof slot === "string" && slot.startsWith("be.tests.world."))
}
