#!/usr/bin/env node
/**
 * GATE — a component that COMPOSES something must SAY so in its Deps tab.
 *
 * WHY. The panel only admits a part that carries a real `storyId`, so a story can look
 * finished while its Deps tab is empty, and nothing anywhere goes red. That failure is
 * silent by construction: no type error, no lint, no build break, and the tab simply does
 * not render. Every instance found so far was found by a human staring at the screen, which
 * is the one method that does not scale.
 *
 * WHAT IT ASKS. For each component under the frame tier and up: which OTHER components does
 * it import, and of those, how many are named with a `storyId` in its own story file? A
 * component importing three siblings and declaring none is the shape of the bug.
 *
 * HOW A COMPONENT IS "DECLARED". Either the bare name appears as an annotate key or a
 * `name:` in a parts tree that also carries a `storyId`, or the story's own `anatPart`
 * self-name matches it. Aliased imports are resolved back to the file's own export.
 *
 * ⚠️ Heuristic. An import can legitimately be a TYPE, an enum, or a helper that renders
 * nothing, so a report here is a QUESTION, not a verdict. It exits 0 and reports, because a
 * gate that blocks on a question trains people to bypass gates.
 */
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(process.argv[2] ?? ".storybook")

const walk = (d, out = []) => {
    if (!fs.existsSync(d)) return out
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) { if (e.name !== "_legacy" && e.name !== "node_modules") walk(p, out) }
        else if (e.name.endsWith(".tsx")) out.push(p)
    }
    return out
}

const rel = (f) => path.relative(process.cwd(), f).split(path.sep).join("/")
const TIERS = ["frames", "composites", "designs", "blocks", "screens", "behaviors"]
const tierOf = (r) => TIERS.find((t) => r.includes(`/components/${t}/`)) ?? null

/** stories/<same path>/**.stories.tsx for a component file. */
const storiesFor = (compFile, allStories) => {
    const fam = path.dirname(rel(compFile)).replace(/^.*\/components\//, "")
    return allStories.filter((s) => path.dirname(rel(s)).replace(/^.*\/stories\//, "") === fam)
}

const allStories = walk(path.join(ROOT, "stories")).filter((f) => f.endsWith(".stories.tsx"))
const comps = walk(path.join(ROOT, "components")).filter((f) => !f.endsWith(".stories.tsx"))

const rows = []
for (const file of comps) {
    const r = rel(file)
    const tier = tierOf(r)
    if (!tier) continue
    const src = fs.readFileSync(file, "utf8")
    if (!/showAnatomy/.test(src)) continue

    // Components this one composes, by their EXPORTED name (aliases resolved to the last id).
    const imported = new Set()
    for (const m of src.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']@sb-components\/([^"']+)["']/g)) {
        if (/\/_/.test(m[2])) continue // private helper module
        for (const raw of m[1].split(",")) {
            const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim()
            if (name && /^[A-Z]/.test(name) && new RegExp(`<${name}[.\\s>]`).test(src)) imported.add(name)
        }
    }
    if (!imported.size) continue

    const stories = storiesFor(file, allStories)
    const storySrc = stories.map((s) => fs.readFileSync(s, "utf8")).join("\n")

    // ⚠️ Matching by NAME is too strict. Parts are routinely named by their ROLE in the
    // parent (`Title`, `SavingLine`) rather than by the component they are, so `Typography`
    // shows up in the tree under a name that is not "Typography". Measured 2026-07-27: that
    // one mistake produced 26 reports, most of them wrong.
    //
    // The honest test is WHERE THE LINK POINTS. Resolve each import to the story-id prefix of
    // its own folder, then ask whether any declared `storyId` in this story starts with it.
    const declaredIds = [...storySrc.matchAll(/storyId:\s*["']([^"']+)["']/g)].map((m) => m[1])
    const importPath = new Map()
    for (const m of src.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']@sb-components\/([^"']+)["']/g)) {
        for (const raw of m[1].split(",")) {
            const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim()
            if (name) importPath.set(name, m[2])
        }
    }
    const prefixOf = (name) => {
        const p = importPath.get(name)
        if (!p) return null
        return path.dirname(p).split("/").join("-").toLowerCase()
    }
    const missing = [...imported].filter((n) => {
        const pre = prefixOf(n)
        return !pre || !declaredIds.some((id) => id.startsWith(pre))
    })
    if (missing.length) rows.push({ r, tier, imported: imported.size, missing, hasStory: stories.length > 0 })
}

const order = Object.fromEntries(["screens", "blocks", "designs", "composites", "frames", "behaviors"].map((t, i) => [t, i]))
rows.sort((a, b) => (order[a.tier] - order[b.tier]) || a.r.localeCompare(b.r))

console.log(`components with showAnatomy that compose something: checked`)
console.log(`components missing at least one dep declaration: ${rows.length}\n`)

let noStory = 0
for (const row of rows) {
    if (!row.hasStory) noStory++
    console.log(`[${row.tier}] ${row.r}${row.hasStory ? "" : "   (NO STORY FILE)"}`)
    console.log(`     composes ${row.imported}, undeclared: ${row.missing.join(" · ")}`)
}
if (noStory) console.log(`\n${noStory} of them have no story file at all.`)
console.log("\nReport only, exits 0: an import can be a type or a helper that renders nothing.")
