/**
 * The adapter between the HFS slot manifest (`knowledge/hfs/slots.yaml`) and the lint rules that need a
 * number or a list the manifest owns: which platform capabilities may be `@Global()`, how long a source
 * file may be, how many names a public `index.ts` may export.
 *
 * The manifest states these in `ruleParams.be` (the same block `ruleParams(manifest, "be")` of
 * `scripts/lib/hfs-slots.mjs` returns) and in the `budget.indexExports` of a `be.*` slot. This file reads only those
 * keys, and there is no other source: a manifest that does not state them, or that cannot be read, stops the lint
 * run with an error naming the file, because the slot check owns the finding and a rule must not guess a number.
 *
 *   - `ruleParams.be.globalModules`  directories `src/modules/platform/<capability>/` allowed to declare `@Global()`;
 *                                    the rule compares the capability `platform/<capability>`
 *   - `ruleParams.be.fileLines`      `{ soft, hardGrowth }`: `soft` is the line budget; with `hardGrowth: true` a file
 *                                    over it may not be born or grow (`file-size-growth`)
 *   - the `budget.indexExports` of the first `be.*` slot that states one, the public-surface width
 *
 * The manifest and the YAML reader come from the installed `@starci/hfs` package, which carries a runtime copy
 * (`runtime/knowledge/hfs/slots.yaml`, `runtime/engine/yaml.mjs`) and is a dependency of this package. They are
 * resolved as `@starci/hfs/runtime/...` with `import.meta.resolve`, never from the product repository's filesystem
 * and never from a link path. `STARCI_HFS_SLOTS` overrides the manifest file (tests, experiments). Inside the runtime
 * repository itself, where `@starci/hfs` is not installed, the sibling `packages/hfs` workspace stands in.
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const SIBLING_HFS = join(HERE, "..", "..", "..", "hfs")

const HFS_SLOTS = "@starci/hfs/runtime/knowledge/hfs/slots.yaml"
const HFS_YAML = "@starci/hfs/runtime/engine/yaml.mjs"

/**
 * Resolves a file of the installed `@starci/hfs` package.
 *
 * @param {string} specifier - The `@starci/hfs/...` specifier.
 * @returns {string} The `file:` URL of the file.
 */
const hfsFile = (specifier) => {
    try {
        return import.meta.resolve(specifier)
    } catch (error) {
        const sibling = join(SIBLING_HFS, specifier.slice("@starci/hfs/".length))
        if (existsSync(join(SIBLING_HFS, "package.json")) && existsSync(sibling)) return pathToFileURL(sibling).href
        throw new Error(`@starci/hfs is not installed (${specifier} does not resolve): add it to dependencies and reinstall. ${error.message}`)
    }
}

const manifestFile = () => process.env.STARCI_HFS_SLOTS || fileURLToPath(hfsFile(HFS_SLOTS))

const toCapability = (dir) => String(dir).replace(/^src\/modules\//, "").replace(/\/+$/, "")

/**
 * Reads the rule parameters out of a parsed manifest.
 *
 * @param {object} manifest - The parsed `slots.yaml`.
 * @returns {{ globalModules: readonly string[], fileLines: { soft: number, hardGrowth: number }, indexExports: number }} The parameters; `fileLines.hardGrowth` is the line count above which a file may not grow.
 */
export const paramsFromManifest = (manifest) => {
    const be = manifest?.ruleParams?.be
    if (!Array.isArray(be?.globalModules) || !be.globalModules.every((name) => typeof name === "string")) throw new Error("slots.yaml states no ruleParams.be.globalModules")
    if (!Number.isInteger(be.fileLines?.soft) || typeof be.fileLines?.hardGrowth !== "boolean") throw new Error("slots.yaml states no ruleParams.be.fileLines {soft, hardGrowth}")
    const indexSlot = Array.isArray(manifest.slots)
        ? manifest.slots.find((slot) => String(slot?.id ?? "").startsWith("be.") && Number.isInteger(slot?.budget?.indexExports))
        : undefined
    if (indexSlot === undefined) throw new Error("slots.yaml states no budget.indexExports on a be.* slot")
    const { soft, hardGrowth } = be.fileLines
    return {
        globalModules: be.globalModules.map(toCapability),
        fileLines: { soft, hardGrowth: hardGrowth ? soft : Number.POSITIVE_INFINITY },
        indexExports: indexSlot.budget.indexExports,
    }
}

const load = async () => {
    const file = manifestFile()
    if (!existsSync(file)) throw new Error(`HFS slot manifest not found at ${file}`)
    const { parseYaml } = await import(hfsFile(HFS_YAML))
    return paramsFromManifest(parseYaml(readFileSync(file, "utf8")))
}

/** The parameters, resolved once per process. */
export const hfsParams = await load()
