#!/usr/bin/env node
/**
 * Pattern-coverage gate — a frame that realises a seam must NAME it.
 *
 * A public layout frame (`StackH·StackV·Cluster·Grid·Split·ResponsiveRow·
 * ResponsiveCluster·RailShell·SplitWorkspace·Reel`) that sets a layout decision
 * (`gap` + any of `justify·align·at·wrap·divider·padding`) MUST also declare
 * `pattern="…"` (a token from `.storybook/test-runner/patterns.mjs`) so it emits
 * `data-principles` and the rendered-tree test can measure it. A frame with a
 * layout decision but no `pattern` = a SEAM HỞ (untestable).
 *
 *   node scripts/check-pattern-coverage.mjs            # gate (exit 1 on any hở)
 *   node scripts/check-pattern-coverage.mjs --report   # list, never exit 1 (scope)
 */
import fs from "fs"
import path from "path"

const ROOT = process.cwd()
const ROOTS = [".storybook/components", "src/components"]
const REPORT = process.argv.includes("--report")
const FRAMES = ["StackH", "StackV", "Cluster", "Grid", "Split", "ResponsiveRow", "ResponsiveCluster", "RailShell", "SplitWorkspace", "Reel"]
// a layout DECISION beyond bare gap — the sign the seam means something nameable
const DECISION = /\b(justify|align|at|wrap|divider|padding|columns|separator)[=\s]/

function walk(dir, out = []) {
    if (!fs.existsSync(dir)) return out
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full, out)
        else if (full.endsWith(".tsx")) out.push(full)
    }
    return out
}

/** Extract each `<Frame …>` opening tag (handles multiline) with its 1-based line. */
function* frameTags(src) {
    const re = new RegExp(`<(${FRAMES.join("|")})(\\s)`, "g")
    let m
    while ((m = re.exec(src))) {
        // find the matching `>` that closes this opening tag (skip nested {} / quotes crudely)
        let i = m.index + m[0].length - 1, depth = 0
        for (; i < src.length; i++) {
            const c = src[i]
            if (c === "{") depth++
            else if (c === "}") depth--
            else if (c === ">" && depth === 0) break
        }
        const tag = src.slice(m.index, i + 1)
        const line = src.slice(0, m.index).split("\n").length
        yield { name: m[1], tag, line }
    }
}

// A raw spacing class on a NON-frame element — an actual spacing decision that must
// still carry `data-principles`. ATOMS are exempt (their inset is fixed primitive
// chrome, not a caller/composition decision — thầy 2026-08-02). Frames pass `pattern`
// (checked above) so their className rarely carries these.
const SPACING = /\b(gap-[1-9]|p-[1-9]|px-[1-9]|py-[1-9]|ml-auto|mt-auto|mx-auto)\b/
// raw-div check applies ONLY to design-system tiers (not atoms/frames, not the
// legacy world src/components/{features,blocks,modals,drawers,providers,…} which is
// being replaced by page/blockv2/modalsv2/drawersv2/layoutsv2).
const DS_ROOTS = [
    ".storybook/components/composites", ".storybook/components/starci",
    "src/components/composites", "src/components/starci", "src/components/page",
    "src/components/blockv2", "src/components/modalsv2", "src/components/drawersv2", "src/components/layoutsv2",
]
const inDesignSystem = (rel) => DS_ROOTS.some((r) => rel.replace(/\\/g, "/").startsWith(r))

const holes = []
for (const root of ROOTS) {
    for (const file of walk(path.join(ROOT, root))) {
        const src = fs.readFileSync(file, "utf8")
        const rel = path.relative(ROOT, file)
        for (const { name, tag, line } of frameTags(src)) {
            if (/\bprinciples[=\s]/.test(tag)) continue     // already named
            if (!DECISION.test(tag)) continue                 // bare gap-only wrapper — skip
            holes.push({ rel, line, name })
        }
        // raw spacing on a plain element (div/span/…) in a composite/block/page — needs data-principles
        if (!inDesignSystem(rel)) continue
        src.split("\n").forEach((l, i) => {
            if (/^\s*(\*|\/\/|\/\*)/.test(l)) return           // a comment line — not real code
            const cm = l.match(/className=(?:"|`)([^"`]*)(?:"|`)/)
            if (!cm || !SPACING.test(cm[1])) return
            if (/\b(data-)?principles[=\s]/.test(l)) return    // named (a `<Box principles>` or literal data-principles)
            holes.push({ rel, line: i + 1, name: "raw", raw: cm[1].match(SPACING)[0] })
        })
    }
}

if (holes.length === 0) {
    console.log("check-pattern-coverage: OK — every layout seam names a pattern.")
    process.exit(0)
}

const byFile = {}
for (const h of holes) (byFile[h.rel] ??= []).push(h)
console.log(`check-pattern-coverage: ${holes.length} seam hở trong ${Object.keys(byFile).length} file\n`)
const files = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)
for (const [rel, hs] of files.slice(0, REPORT ? 999 : 60)) {
    console.log(`  ${rel}  (${hs.length}: ${[...new Set(hs.map((h) => h.name))].join(",")})`)
}
if (!REPORT && files.length > 60) console.log(`  … +${files.length - 60} file nữa`)
console.log(`\nFix: thêm pattern="<token>" (patterns.mjs) cho từng seam theo Ý ĐỒ nó.`)
if (!REPORT) process.exit(1)
