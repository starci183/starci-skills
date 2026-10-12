/**
 * Generate Common's catalog from authored YAML rules[].id, never from references or case ids.
 * Stable addresses stay exactly as declared, including sparse numbering and MARGIN-AUTO. Before
 * replacing the catalog, require every production rule-id string to resolve to current authority.
 * Retired catalog ids are reported explicitly; deciding their semantic consumer migration remains
 * an owner review, not a claim this static generator can establish.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { parseYaml } from "../../../engine/yaml.mjs"
import { readEnv } from "../../../scripts/lib/env.mjs"
import { byCodeUnit } from "../../../scripts/lib/list.mjs"
import { isMain } from "../../../scripts/lib/is-main.mjs"
import { lexSource } from "../../../scripts/work/ui/grammar-knowledge-lex.mjs"
import { RULE_ID, ruleCatalog } from "../../../scripts/work/ui/grammar-knowledge-renderers.mjs"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_KNOWLEDGE_DIR = resolve(packageRoot, "../../knowledge")
const FAMILY_DIRECTORIES = ["ui/composition", "ui/presentation", "ui/proof", "grammars/starci"]
const isTopicFile = (name) => name.endsWith(".yaml") && !name.endsWith(".vi.yaml") && name.toLowerCase() !== "index.yaml" && !name.startsWith("_pending-")
const prefixOf = (id) => id.slice(0, id.lastIndexOf("-"))

/** Read top-level rule declarations; a malformed rules field or id refuses generation. */
function topicRuleIds(file) {
    const topic = parseYaml(readFileSync(file, "utf8"))
    if (topic?.rules === undefined) return []
    if (topic.schema !== "starci/knowledge-source@1" || !Array.isArray(topic.rules)) throw new Error("Invalid rule topic: " + file)
    return topic.rules.map((rule) => {
        if (typeof rule?.id !== "string" || !RULE_ID.test(rule.id)) throw new Error("Invalid rule id in " + file + ": " + String(rule?.id))
        return rule.id
    })
}

/** Collect unique declarations without writing, grouping mixed topics by their actual id prefixes. */
export function collectRuleCatalog({ knowledgeDir }) {
    const familiesByPrefix = new Map()
    const seen = new Map()
    for (const relative of FAMILY_DIRECTORIES) {
        for (const name of readdirSync(join(knowledgeDir, relative)).filter(isTopicFile).sort(byCodeUnit)) {
            const source = relative + "/" + name
            for (const id of topicRuleIds(join(knowledgeDir, source))) {
                if (seen.has(id)) throw new Error("Rule id declared twice: " + id + " (" + seen.get(id) + ", " + source + ")")
                seen.set(id, source)
                const family = prefixOf(id)
                if (!familiesByPrefix.has(family)) familiesByPrefix.set(family, { family, ids: [], sources: [] })
                const row = familiesByPrefix.get(family)
                row.ids.push(id)
                if (!row.sources.includes(source)) row.sources.push(source)
            }
        }
    }
    if (seen.size === 0) throw new Error("Knowledge topics declare no rules: " + knowledgeDir)
    const families = [...familiesByPrefix.values()].sort((one, other) => byCodeUnit(one.family, other.family))
    return { families, ids: families.flatMap(({ ids }) => ids) }
}

/** Render only the collected declarations, without inventing addresses from family counts. */
export function renderRuleCatalog({ families, ids }) {
    const counts = families.map(({ family, ids, sources }) =>
        "    " + JSON.stringify(family) + ": " + ids.length + ", // " + sources.join(", ")).join("\n")
    const entries = families.map(({ family, ids }) =>
        "    // " + family + "\n" + ids.map((id) => "    " + JSON.stringify(id) + ",").join("\n")).join("\n")
    return "/*\n" +
        " * GENERATED FILE - do not edit by hand.\n" +
        " * Regenerate with node packages/grammar/scripts/generate-rule-catalog.mjs [knowledgeDir].\n" +
        " * Canonical declarations are rules[].id in the YAML knowledge topics.\n" +
        " * References, scale rows, cases and closed addresses contribute no additional rules.\n" +
        " * " + families.length + " families, " + ids.length + " rules.\n" +
        " */\n\n" +
        "/** The number of declared rule ids in each family, never expanded into addresses. */\n" +
        "export const RULE_FAMILY_COUNTS = Object.freeze({\n" + counts + "\n} as const)\n\n" +
        "/** Every declared canonical rule id, preserving each topic's authored order. */\n" +
        "export const CANONICAL_RULE_IDS: ReadonlyArray<string> = Object.freeze([\n" + entries + "\n])\n"
}

/**
 * Read production literal and computed rule-id strings with the owning census lexer. Comments,
 * stories, test modules and the generated declaration table are not consumer claims. Existence
 * checking is conservative: every rule-shaped production string must resolve, even off the registry.
 */
export function collectPackageRuleClaims({ packageRoot }) {
    const claims = []
    const walk = (directory) => {
        for (const entry of readdirSync(directory, { withFileTypes: true }).sort((one, other) => byCodeUnit(one.name, other.name))) {
            const full = join(directory, entry.name)
            if (entry.isDirectory()) {
                if (!["stories", "__test__", "node_modules"].includes(entry.name)) walk(full)
                continue
            }
            if (!entry.isFile() || !/\.(?:tsx?|mts)$/.test(entry.name) || /\.(?:spec|test)\./.test(entry.name) || entry.name === "rule-catalog.generated.ts") continue
            const source = relative(packageRoot, full).replaceAll("\\", "/")
            for (const { value } of lexSource(readFileSync(full, "utf8")).strings) {
                for (const id of value.split(/[\s,]+/).filter((token) => RULE_ID.test(token))) claims.push({ id, source })
            }
        }
    }
    walk(join(packageRoot, "src"))
    return claims
}

/**
 * Validate authority, prior catalog and all production claims before the first write. Retired ids
 * may disappear only after consumers no longer claim them; the returned delta makes that explicit.
 */
export function generateRuleCatalog({ knowledgeDir, packageRoot, target = join(packageRoot, "src/common/rule-catalog.generated.ts") }) {
    const catalog = collectRuleCatalog({ knowledgeDir })
    const ids = new Set(catalog.ids)
    const published = existsSync(target) ? ruleCatalog(packageRoot, { file: target }).ids : []
    const unknown = collectPackageRuleClaims({ packageRoot }).filter(({ id }) => !ids.has(id))
    if (unknown.length > 0) throw new Error("Production rule claims have no current declaration: " + unknown.map(({ id, source }) => id + " (" + source + ")").join(", "))
    const retiredIds = published.filter((id) => !ids.has(id))
    const addedIds = catalog.ids.filter((id) => !published.includes(id))
    const output = renderRuleCatalog(catalog)
    const changed = !existsSync(target) || readFileSync(target, "utf8") !== output
    if (changed) writeFileSync(target, output, "utf8")
    return { ...catalog, retiredIds, addedIds, changed }
}

/** Write this package's catalog only after validating inputs and migrated production claims. */
export function main(argv = process.argv.slice(2)) {
    if (argv.length > 1) throw new Error("Usage: node packages/grammar/scripts/generate-rule-catalog.mjs [knowledgeDir]")
    const knowledgeDir = resolve(argv[0] ?? readEnv("STARCI_KNOWLEDGE_DIR") ?? DEFAULT_KNOWLEDGE_DIR)
    const target = join(packageRoot, "src/common/rule-catalog.generated.ts")
    const { families, ids, retiredIds, addedIds, changed } = generateRuleCatalog({ knowledgeDir, packageRoot, target })
    process.stdout.write(target + "\n" + families.length + " families, " + ids.length + " rules; changed=" + changed + "\n")
    process.stdout.write("Retired catalog ids (no remaining production claims): " + (retiredIds.join(", ") || "none") + "\n")
    process.stdout.write("Added declared ids: " + (addedIds.join(", ") || "none") + "\n")
    for (const { family, ids, sources } of families) process.stdout.write("  " + family + ": " + ids.length + " (" + sources.join(", ") + ")\n")
}

if (isMain(import.meta.url)) main()
