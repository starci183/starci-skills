#!/usr/bin/env node
/**
 * Doc-parity gate: the leading `/** ... *​/` design-spec block of a storybook
 * COMPONENT (`.storybook/components/<sub>/<Name>.tsx`) must be IDENTICAL to the
 * leading block of its STORY (`.storybook/stories/<sub>/<Name>.stories.tsx`).
 *
 * Source of truth = the STORY (it becomes the autodocs description). Run with
 * `--fix` to copy each story's leading block down into its component verbatim.
 *
 *   node scripts/check-doc-parity.mjs         # report + gate (exit 1 on drift)
 *   node scripts/check-doc-parity.mjs --fix   # rewrite drifted components from stories
 */
import fs from "fs"
import path from "path"

const ROOT = process.cwd()
const COMPONENTS_DIR = path.join(ROOT, ".storybook", "components")
const STORIES_DIR = path.join(ROOT, ".storybook", "stories")
const FIX = process.argv.includes("--fix")

/** Walk a dir, return all files matching `pred`. */
function walk(dir, pred, out = []) {
    if (!fs.existsSync(dir)) return out
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full, pred, out)
        else if (pred(full)) out.push(full)
    }
    return out
}

/**
 * The FIRST top-level block comment in a source file — the leading design-spec
 * `/** ... *​/`. Returns `{ raw, inner, start, end }` (char offsets) or null.
 * `inner` = normalized text (each line stripped of leading `* ` and trimmed),
 * used only for COMPARISON; `raw` (verbatim) is what `--fix` copies.
 */
function leadingDoc(src) {
    const open = src.indexOf("/**")
    if (open === -1) return null
    const close = src.indexOf("*/", open)
    if (close === -1) return null
    const end = close + 2
    const raw = src.slice(open, end)
    const inner = raw
        .replace(/^\/\*\*/, "")
        .replace(/\*\/$/, "")
        .split("\n")
        .map((l) => l.replace(/^\s*\*\s?/, "").replace(/\s+$/, ""))
        .join("\n")
        .trim()
    return { raw, inner, start: open, end }
}

/**
 * A file `<Name>.tsx` may be a thin BARREL that just re-exports the real impl
 * from a sibling (`export { ButtonBase as Button }` + `import { ButtonBase } from
 * "./ButtonBase"`). The design doc that pairs with the STORY lives in that impl
 * file, not the barrel. Resolve `<Name>.tsx` → the impl file when it is such a
 * barrel; otherwise `<Name>.tsx` is itself the impl.
 */
function resolveImpl(compFile, name) {
    const src = fs.readFileSync(compFile, "utf8")
    const exp = src.match(new RegExp(`export\\s*\\{\\s*(\\w+)\\s+as\\s+${name}\\s*\\}`))
    if (!exp) return compFile
    const impl = exp[1]
    const imp = src.match(new RegExp(`import\\s*\\{[^}]*\\b${impl}\\b[^}]*\\}\\s*from\\s*["'](\\.[^"']+)["']`))
    if (!imp) return compFile
    const implFile = path.join(path.dirname(compFile), imp[1] + ".tsx")
    return fs.existsSync(implFile) ? implFile : compFile
}

// component `<sub>/<Name>.tsx`  ->  story `<sub>/<Name>.stories.tsx`
const components = walk(COMPONENTS_DIR, (f) => f.endsWith(".tsx") && !f.endsWith(".stories.tsx"))

let matched = 0, drift = 0, noStory = 0, noDocEither = 0, barrels = 0
const driftList = []
const fixed = []

for (const compFile of components) {
    const rel = path.relative(COMPONENTS_DIR, compFile)          // sub/Name.tsx
    const storyFile = path.join(STORIES_DIR, rel.replace(/\.tsx$/, ".stories.tsx"))
    if (!fs.existsSync(storyFile)) { noStory++; continue }

    const name = path.basename(compFile, ".tsx")
    const implFile = resolveImpl(compFile, name)
    if (implFile !== compFile) barrels++

    const compSrc = fs.readFileSync(implFile, "utf8")
    const storySrc = fs.readFileSync(storyFile, "utf8")
    const compDoc = leadingDoc(compSrc)
    const storyDoc = leadingDoc(storySrc)

    if (!storyDoc || !compDoc) { noDocEither++; continue }

    if (compDoc.inner === storyDoc.inner) { matched++; continue }

    drift++
    driftList.push(path.relative(ROOT, implFile))

    if (FIX) {
        // Splice the story's verbatim block over the impl file's leading block,
        // preserving its indentation context (leading blocks sit at column 0 in
        // both trees).
        const next = compSrc.slice(0, compDoc.start) + storyDoc.raw + compSrc.slice(compDoc.end)
        fs.writeFileSync(implFile, next)
        fixed.push(path.relative(ROOT, implFile))
    }
}

console.log(`components scanned : ${components.length}`)
console.log(`  (barrels → impl  : ${barrels})`)
console.log(`paired w/ story    : ${components.length - noStory}`)
console.log(`  [ok]   doc match : ${matched}`)
console.log(`  [DRIFT] mismatch : ${drift}`)
console.log(`  [skip] no doc    : ${noDocEither}`)
console.log(`no sibling story   : ${noStory}`)

if (FIX) {
    console.log(`\n--fix: rewrote ${fixed.length} component(s) from their story.`)
} else if (drift > 0) {
    console.log(`\nDRIFT (${drift}) — component leading doc ≠ story:`)
    for (const f of driftList.slice(0, 60)) console.log("  " + f)
    if (driftList.length > 60) console.log(`  … +${driftList.length - 60} more`)
    console.log(`\nRun: node scripts/check-doc-parity.mjs --fix`)
    process.exit(1)
}
