/**
 * The adapter between the HFS v2 slot manifest (`knowledge/hfs/slots.yaml`) and the lint rules that need a
 * number or a list the manifest owns: which platform capabilities may be `@Global()`, how long a source
 * file may be, how many names a public `index.ts` may export.
 *
 * WHY AN ADAPTER AND NOT A LOADER CALL. The slot loader (`scripts/lib/hfs-slots.mjs`, lane hfs2-slots) answers
 * path questions for the architecture machine. A lint rule needs three scalars and must stay importable from
 * a checkout that has no loader yet, so this file reads the manifest itself and asks only for those keys:
 *
 *   - `ruleParams.be.globalModules`  list of `platform/<capability>` allowed to declare `@Global()`
 *   - `ruleParams.be.fileLines`      the soft line budget of one back-end source file
 *   - the `budget.indexExports` of the `be.domain` slot, the public-surface width
 *
 * Any key the manifest does not carry yet takes the value the rule catalog (HFS-V2-RULES R20, R30, R45)
 * states. `source` says which one answered, so a test can prove the manifest is actually being read.
 * The manifest is found through `STARCI_HFS_SLOTS`, else at `<runtime>/knowledge/hfs/slots.yaml` above this
 * package; when neither exists the catalog values are used and `source` is `catalog`.
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const RUNTIME_ROOT = join(HERE, "..", "..", "..", "..")

/** The catalog values (HFS-V2-RULES), the answer when the manifest is silent. */
export const CATALOG_PARAMS = Object.freeze({
    globalModules: Object.freeze(["platform/config", "platform/logging", "platform/database"]),
    fileLines: 500,
    indexExports: 60,
})

const manifestFile = () => {
    const chosen = process.env.STARCI_HFS_SLOTS
    if (chosen) return chosen
    const inRuntime = join(RUNTIME_ROOT, "knowledge", "hfs", "slots.yaml")
    return existsSync(inRuntime) ? inRuntime : null
}

/**
 * Reads the rule parameters out of a parsed manifest.
 *
 * @param {object | null} manifest - The parsed `slots.yaml`, or null.
 * @returns {{ globalModules: readonly string[], fileLines: number, indexExports: number }} Parameters with the source of each answer in `source`.
 */
export const paramsFromManifest = (manifest) => {
    const be = manifest?.ruleParams?.be ?? {}
    const domainSlot = Array.isArray(manifest?.slots) ? manifest.slots.find((slot) => slot?.id === "be.domain") : undefined
    const fromManifest = {
        globalModules: Array.isArray(be.globalModules) && be.globalModules.every((name) => typeof name === "string") ? be.globalModules : undefined,
        fileLines: Number.isInteger(be.fileLines) ? be.fileLines : undefined,
        indexExports: Number.isInteger(domainSlot?.budget?.indexExports) ? domainSlot.budget.indexExports : undefined,
    }
    const params = {
        globalModules: fromManifest.globalModules ?? CATALOG_PARAMS.globalModules,
        fileLines: fromManifest.fileLines ?? CATALOG_PARAMS.fileLines,
        indexExports: fromManifest.indexExports ?? CATALOG_PARAMS.indexExports,
    }
    const source = Object.fromEntries(Object.entries(fromManifest).map(([key, value]) => [key, value === undefined ? "catalog" : "manifest"]))
    return { ...params, source }
}

const load = async () => {
    const file = manifestFile()
    if (!file || !existsSync(file)) return paramsFromManifest(null)
    try {
        const { parseYaml } = await import(new URL("../../../../engine/yaml.mjs", import.meta.url))
        return paramsFromManifest(parseYaml(readFileSync(file, "utf8")))
    } catch {
        // an unreadable manifest is not this rule's finding; the slot check owns HFS_MANIFEST_INVALID
        return paramsFromManifest(null)
    }
}

/** The parameters, resolved once per process. */
export const hfsParams = await load()
