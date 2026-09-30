/**
 * The one door between the lint rules and the HFS slot manifest of the repository being linted.
 *
 * A consuming `eslint.config.mjs` is the one line `export default starciBeConfig({ hfs: loadHfs(import.meta.url) })`.
 * `loadHfs` reads the repository's `hfs.json` beside that config file and the slot manifest this package ships in
 * `runtime/` (a byte copy of the runtime's `knowledge/hfs/slots.yaml` and `scripts/lib/hfs-slots.mjs`, refreshed by
 * `packages/hfs/scripts/sync-runtime.mjs`), and returns an object the factory puts in `settings.starci.hfs`.
 *
 * Every path-scoped rule asks `slotOf` here instead of testing a path with a regular expression: a rule never assumes
 * `/src/modules/` or `/src/tests/`. A rule that needs the manifest and finds no `settings.starci.hfs` stops the lint run
 * with an error naming the fix, because a rule must not guess.
 */
import { dirname, isAbsolute, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { openHfs } from "../runtime/scripts/lib/hfs-slots.mjs"

const RUNTIME = join(dirname(fileURLToPath(import.meta.url)), "..", "runtime")

const posix = (p) => String(p).replace(/\\/g, "/")

/**
 * Wraps an opened HFS resolver as the object rules read.
 *
 * @param {object} opened - The result of `openHfs` (manifest, repo and resolver methods).
 * @param {string} repoRoot - The absolute repository root.
 * @returns {object} The frozen HFS view of one repository.
 */
const view = (opened, repoRoot) => {
    const rel = (file) => {
        const text = posix(file)
        if (!isAbsolute(text) && !/^[A-Za-z]:\//.test(text)) return text.replace(/^\.\//, "")
        return posix(relative(repoRoot, file))
    }
    const slotCache = new Map()
    const classify = (file) => {
        const key = rel(file)
        if (!slotCache.has(key)) slotCache.set(key, opened.classifyPath(key))
        return slotCache.get(key)
    }
    return Object.freeze({
        repoRoot,
        profile: opened.repo.profile,
        apps: opened.repo.apps,
        connections: opened.repo.connections,
        ruleParams: opened.ruleParams(),
        /** The repository-relative, forward-slash form of a linted filename. */
        relative: rel,
        /** The classification of a file: `{ slot, tier, owner?, bindings? ... }` or a no-slot status. */
        classify,
        /** The slot id that owns a file, or null when no slot does. */
        slotOf: (file) => classify(file).slot ?? null,
        /** The tier of a file (`feature`, `domain`, `platform`, `integrations`, `app`, `e2e`, `fixtures`), or null. */
        tierOf: (file) => opened.tierOf(rel(file)) ?? null,
        /** The owner root of a file (`src/modules/domain/order`), or null. */
        ownerOf: (file) => opened.ownerOf(rel(file))?.root ?? null,
        /** A slot definition by id. */
        slot: (id) => opened.slot(id),
    })
}

/**
 * The HFS view of the repository whose `eslint.config.mjs` calls this.
 *
 * @param {string} configUrl - `import.meta.url` of the repository's `eslint.config.mjs`.
 * @returns {object} The frozen HFS view (profile, apps, connections, ruleParams, slotOf, tierOf, ownerOf).
 */
export const loadHfs = (configUrl) => {
    const repoRoot = dirname(fileURLToPath(configUrl))
    return view(openHfs({ root: RUNTIME, repoRoot }), repoRoot)
}

/**
 * The HFS view of an in-memory declaration, for rule tests: no file is read except the shipped manifest.
 *
 * @param {object} declaration - An `hfs.json` object.
 * @param {string} repoRoot - The absolute root the linted filenames live under.
 * @returns {object} The frozen HFS view.
 */
export const hfsFromDeclaration = (declaration, repoRoot) => view(openHfs({ root: RUNTIME, declaration }), repoRoot)

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
