/**
 * Regenerate the Common UI rule catalog from the canonical knowledge tree.
 *
 * WHY THIS EXISTS. `conformance.ts` used to carry a hand-written family table. A hand-written copy
 * of somebody else's catalog is only ever correct on the day it is typed: the tree renamed
 * `accessibility` from `ACCESSIBILITY-n` to `A11Y-n`, retired COLOR, MEDIA, FIELD, ICON, SIZING,
 * INTERACTION and CONTROL-STATE, and added MEASURE, OVERFLOW, TONE and FLOW, while the table went
 * on asserting the 2024 shape and every conformance check went on passing against it.
 *
 * WHAT A FAMILY IS. One topic file under `ui/composition`, `ui/presentation`, `ui/proof` or
 * `grammars/starci`. Translations (`*.vi.md`), directory indexes (`INDEX.md`) and files still
 * parked under a `_pending-` name are not topics and are skipped.
 *
 * WHAT A RULE IS. A heading whose text starts with an id of the form `PREFIX-n`. The prefix is
 * read from the heading rather than inferred from the filename, because the two disagree on
 * purpose: `accessibility.md` publishes `A11Y-n`, `render-truth.md` publishes `TRUTH-n`, and
 * `text-flow.md` publishes `FLOW-n`. Numbering is read rather than assumed for the same reason -
 * the spacing families start at `-0`, so `1..count` would invent a rule and drop a real one.
 *
 * Usage: node scripts/generate-rule-catalog.mjs [knowledgeDir]
 *        STARCI_KNOWLEDGE_DIR=<path> node scripts/generate-rule-catalog.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, "..")

/** The knowledge tree lives in the host repository, checked out beside this one. */
const DEFAULT_KNOWLEDGE_DIR = resolve(packageRoot, "../../../starci-academy-backend/.claude/knowledge")
const knowledgeDir = resolve(process.argv[2] ?? process.env.STARCI_KNOWLEDGE_DIR ?? DEFAULT_KNOWLEDGE_DIR)

/** Directories whose topic files each publish one rule family. */
const FAMILY_DIRECTORIES = [
    "ui/composition",
    "ui/presentation",
    "ui/proof",
    "grammars/starci",
]

/** A topic file: markdown, not a translation, not an index, not parked for a move. */
const isTopicFile = (name) =>
    name.endsWith(".md") && !name.endsWith(".vi.md") && name !== "INDEX.md" && !name.startsWith("_pending-")

const RULE_HEADING = /^#{1,6}\s+([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+)\b/

/** Every rule id a topic file publishes, in the order the file publishes them. */
const ruleIdsIn = (file) => {
    const ids = []
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        const hit = RULE_HEADING.exec(line)
        if (hit !== null && !ids.includes(hit[1])) ids.push(hit[1])
    }
    return ids
}

const families = []
for (const relative of FAMILY_DIRECTORIES) {
    const directory = join(knowledgeDir, relative)
    let entries
    try {
        entries = readdirSync(directory).filter(isTopicFile).sort()
    } catch {
        throw new Error(`Knowledge directory not found: ${directory}. Pass the tree path as the first argument or set STARCI_KNOWLEDGE_DIR.`)
    }
    for (const name of entries) {
        const ids = ruleIdsIn(join(directory, name))
        if (ids.length === 0) continue
        const prefixes = new Set(ids.map((id) => id.slice(0, id.lastIndexOf("-"))))
        if (prefixes.size > 1) throw new Error(`${relative}/${name} publishes more than one family prefix: ${[...prefixes].join(", ")}`)
        families.push({ source: `${relative}/${name}`, family: [...prefixes][0], ids })
    }
}

families.sort((one, other) => one.family.localeCompare(other.family))

const duplicates = new Set()
const seen = new Set()
for (const { ids } of families) for (const id of ids) (seen.has(id) ? duplicates : seen).add(id)
if (duplicates.size > 0) throw new Error(`Rule ids published by more than one family: ${[...duplicates].join(", ")}`)

const quote = (value) => `"${value}"`
const familyLine = ({ family, ids, source }) => `    ${JSON.stringify(family)}: ${ids.length}, // ${source}`
const idsBlock = families
    .map(({ family, ids }) => `    // ${family}\n${ids.map((id) => `    ${quote(id)},`).join("\n")}`)
    .join("\n")

const output = `/*
 * GENERATED FILE - do not edit by hand.
 *
 * Regenerate with \`node scripts/generate-rule-catalog.mjs [knowledgeDir]\` from the package root.
 * The source of truth is the knowledge tree's \`ui/composition\`, \`ui/presentation\`, \`ui/proof\`
 * and \`grammars/starci\` topic files; a family that publishes no \`PREFIX-n\` heading contributes
 * no rules and therefore does not appear here.
 *
 * ${families.length} families, ${seen.size} rules.
 */

/** How many rule ids each family publishes. Reported for coverage summaries, never expanded. */
export const RULE_FAMILY_COUNTS = Object.freeze({
${families.map(familyLine).join("\n")}
} as const)

/**
 * Every canonical rule id, exactly as the tree spells it.
 *
 * The ids are listed rather than expanded from the counts above: the spacing families start at
 * \`-0\`, so a \`1..count\` expansion would both invent \`PADDING-9\` and lose \`PADDING-0\`.
 */
export const CANONICAL_RULE_IDS: ReadonlyArray<string> = Object.freeze([
${idsBlock}
])
`

const target = join(packageRoot, "src/common/rule-catalog.generated.ts")
writeFileSync(target, output, "utf8")
process.stdout.write(`${target}\n${families.length} families, ${seen.size} rules\n`)
for (const { family, ids, source } of families) process.stdout.write(`  ${family}: ${ids.length} (${source})\n`)
