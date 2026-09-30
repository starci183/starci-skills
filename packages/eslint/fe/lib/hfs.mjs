/**
 * The one door between the front-end lint rules and the HFS slot manifest of the repository being linted.
 *
 * A consuming `eslint.config.mjs` is the managed one-liner `export default starciFeConfig({ hfs: loadHfs(import.meta.url) })`.
 * The config lives in the fe/ side folder of an app; `loadHfs` finds the app-root `hfs.json` one level up and gives every file
 * linted under that folder the view of the fe side (paths relative to fe/), with the slot manifest this package ships in
 * `runtime/` (a byte copy of the runtime's `knowledge/hfs/slots.yaml`, `scripts/lib/hfs-slots.mjs` and
 * `scripts/lib/hfs-view.mjs`, refreshed by `packages/hfs/scripts/sync-runtime.mjs`), and returns the view the factory puts
 * in `settings.starci.hfs`.
 *
 * Every path-scoped rule asks `slotOf` / `tierOf` here instead of testing a path with a regular expression. A rule that
 * needs the view and finds none stops the lint run with an error naming the fix: a rule must not guess.
 */
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { declaredHfsView, openHfsView } from "../runtime/scripts/lib/hfs-view.mjs"

const RUNTIME = join(dirname(fileURLToPath(import.meta.url)), "..", "runtime")

/**
 * The HFS view of the side whose `eslint.config.mjs` (in fe/) calls this.
 *
 * @param {string} configUrl - `import.meta.url` of the repository's `eslint.config.mjs`.
 * @returns {object} The frozen HFS view.
 */
export const loadHfs = (configUrl) => openHfsView({ runtimeRoot: RUNTIME, repoRoot: dirname(fileURLToPath(configUrl)) })

/**
 * The HFS view of the fe side of an in-memory app declaration, for rule tests.
 *
 * @param {object} declaration - An app `hfs.json` object.
 * @param {string} repoRoot - The absolute fe side folder the linted filenames live under.
 * @returns {object} The frozen HFS view.
 */
export const hfsFromDeclaration = (declaration, repoRoot) => declaredHfsView({ runtimeRoot: RUNTIME, declaration, repoRoot, side: "fe" })

/**
 * The HFS view a rule runs under; a rule that needs it and gets none refuses to guess.
 *
 * @param {object} context - The ESLint rule context.
 * @returns {object} The HFS view from `settings.starci.hfs`.
 */
export const hfsOf = (context) => {
  const hfs = context.settings?.starci?.hfs
  if (!hfs || typeof hfs.slotOf !== "function") {
    throw new Error(`${context.id ?? "a starci-fe rule"} needs settings.starci.hfs: lint through starciFeConfig({ hfs: loadHfs(import.meta.url) })`)
  }
  return hfs
}
