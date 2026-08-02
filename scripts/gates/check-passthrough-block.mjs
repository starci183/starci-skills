#!/usr/bin/env node
/**
 * GATE — a block must EARN its layer. No block that only forwards.
 *
 * WHY NOW. Deleting the design tier let a block import another block, which is the right
 * model (`block = knows the domain`, and one domain thing can be built from another). But it
 * removes the only thing that used to stop a chain: under the old rule a block could not wrap
 * a block, so depth was capped by the type system rather than by discipline.
 *
 * Without a replacement, nothing prevents `A` wrapping `B` wrapping `C`, each layer adding a
 * rename and nothing else. `AsyncContentEmpty` is the shape to watch: it sets a default icon
 * and hands everything else to `FeedbackEmpty` — architecture on the surface, bookkeeping
 * underneath.
 *
 * WHAT COUNTS AS EARNING IT. A block that renders exactly ONE child component must add
 * domain knowledge of its own: a business condition, a decision, a rule — OR the wording
 * itself, turning typed domain data into the sentence the user reads.
 *
 * ⚠️ CORRECTED 2026-07-28. The first cut said the opposite — "formatting a string is not
 * enough, a formatter is presentation work" — and on that basis flagged `ContinueLearning`,
 * which takes `lessonIndex`/`lessonsRead`/`challengesDone` and builds `Bài 4 · …` from them.
 * That is precisely what canon §14d.1 REQUIRES of a block: "câu dẫn là phần trình bày ⇒
 * BLOCK sở hữu. Caller chỉ đưa dữ liệu miền; block tự ghép câu." The gate was penalising the
 * rule it was meant to protect. A gate that argues with the canon loses.
 *
 * So the test is not "does it format?" but "does it KNOW the domain?": a wrapper that passes
 * strings straight through earns nothing; one that receives typed domain values and words
 * them is the only place that translation is allowed to live.
 *
 * ⚠️ Heuristic, and deliberately loud rather than blocking: "adds domain knowledge" is a
 * judgement no regex settles. It exits 0 and reports, so a real passthrough gets argued about
 * instead of silently shipped.
 */
import fs from "node:fs"
import path from "node:path"

// Skip FLAGS when reading the root. `--control` used to land here as a path and go unnoticed
// because `walk` tolerates a missing directory; listing app folders does not.
const ROOT = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) ?? ".storybook")

const walk = (d, out = []) => {
    if (!fs.existsSync(d)) return out
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) { if (e.name !== "_legacy" && e.name !== "node_modules") walk(p, out) }
        else if (e.name.endsWith(".tsx") && !e.name.endsWith(".stories.tsx")) out.push(p)
    }
    return out
}
const rel = (f) => path.relative(process.cwd(), f).split(path.sep).join("/")

/** A real decision, not a rename: a branch on data, or a self-hide. */
const DECIDES = /return null|\bif\s*\(|\?\s*[A-Za-z"'`{]/

const rows = []
// Blocks live under an APP folder now (`components/<app>/blocks`), so walking one fixed
// path would silently check nothing the day a second app lands. Walk every app.
const blockDirs = fs
    .readdirSync(path.join(ROOT, "components"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => path.join(ROOT, "components", e.name, "blocks"))
    .filter((p) => fs.existsSync(p))

for (const file of blockDirs.flatMap((d) => walk(d))) {
    const raw = fs.readFileSync(file, "utf8")
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    if (/Object\.assign/.test(code) && !/<[A-Z]/.test(code)) continue // namespace index only

    const kids = [...new Set([...code.matchAll(/<([A-Z][\w.]*)[\s/>]/g)].map((m) => m[1].split(".")[0]))]
        .filter((n) => !["React", "Fragment"].includes(n))
    if (kids.length !== 1) continue

    const lines = code.split("\n").filter((l) => l.trim()).length
    const decides = DECIDES.test(code)
    /**
     * Building a sentence out of the block's OWN typed props is domain knowledge, not
     * formatting: it is the one place §14d.1 allows domain values to become words. Read as
     * "a template string that interpolates something this component received".
     */
    const words = [...code.matchAll(/`[^`]*\$\{([^}]*)\}/g)].some((m) => /[a-z]/.test(m[1]))

    if (!decides && !words) rows.push({ f: rel(file), child: kids[0], lines })
}

if (process.argv.includes("--control")) {
    // A zero from a gate that was just LOOSENED is exactly the zero worth distrusting. Prove
    // it still catches a real passthrough, and still lets a real block through.
    const passthrough = ["export const Wrap = (props: P) => (", '    <Inner {...props} tone="danger" />', ")"]
    const wording = ["export const Real = ({ n }: P) => (", "    <Inner title={`Bài ${n}`} />", ")"]
    const flags = (lines) => {
        const code = lines.join("\n")
        const decides = DECIDES.test(code)
        const words = [...code.matchAll(/`[^`]*\$\{([^}]*)\}/g)].some((m) => /[a-z]/.test(m[1]))
        return !decides && !words
    }
    const ok = flags(passthrough) && !flags(wording)
    console.log(
        ok
            ? "✓ negative control: bắt được lớp bọc trần, và KHÔNG bắt block tự ghép câu"
            : `✗ negative control HỎNG — bọc-trần:${flags(passthrough)} ghép-câu:${flags(wording)}`,
    )
    process.exit(ok ? 0 : 2)
}

console.log(`blocks that only forward to ONE child: ${rows.length}\n`)
for (const r of rows) {
    console.log(`  ${r.f}`)
    console.log(`     wraps <${r.child}>, ${r.lines} lines, contributes no decision and no wording`)
}
if (rows.length) console.log(`\nEither give it a decision of its own, or fold it into the child it wraps.`)
