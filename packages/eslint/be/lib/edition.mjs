/**
 * The edition gate of the back-end plugin.
 *
 * Edition applicability belongs to the HFS rule catalog, beside the law and its enforcer. A rule
 * that the catalog does not judge in this app's edition still ships in the plugin, but its `create`
 * returns no listeners. The plugin wiring therefore has one generic gate instead of edition checks
 * scattered through rule bodies.
 */
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadRuleCatalog } from "../runtime/scripts/hfs/slots.mjs"

const RUNTIME = join(dirname(fileURLToPath(import.meta.url)), "..", "runtime")
let catalogCache

/** The bundled rule catalog, loaded once per lint process. */
const bundledCatalog = () => {
    catalogCache ??= loadRuleCatalog({ root: RUNTIME })
    return catalogCache
}

/** A rule which intentionally registers no listeners in this edition. */
const inactive = (rule) => Object.freeze({ ...rule, create: () => ({}) })

/**
 * The plugin view for one HFS edition.
 *
 * Full is the default edition and the catalog's superset, so it needs no runtime catalog read. This
 * keeps the source checkout testable before `sync-runtime` refreshes the generated bundle; lite
 * loads the package's bundled catalog in a published installation. Tests may inject a catalog to
 * prove the generic filtering independently of generated copies.
 */
export const pluginForEdition = ({ plugin, hfs, catalog }) => {
    if ((hfs?.edition ?? "full") === "full" && catalog === undefined) return plugin
    const loaded = catalog ?? bundledCatalog()
    const rules = Object.fromEntries(Object.entries(plugin.rules).map(([id, rule]) => [
        id,
        loaded.enforcerJudgedIn("eslint-be", id, hfs?.edition ?? "full") ? rule : inactive(rule),
    ]))
    return Object.freeze({ ...plugin, rules: Object.freeze(rules) })
}
