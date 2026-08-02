#!/usr/bin/env node
/**
 * GATE — a namespace MEMBER is a leaf, never a state.
 *
 * §11f splits the two: a LEAF is a composition, a STATE is the same composition under a
 * different DATA condition. `PriceTag.Inline` and `PriceTag.Prominent` are two members of a
 * namespace, so a caller types two different names to reach them. Two names is two doors, and
 * a door is a leaf.
 *
 * Folding them into one leaf's state tabs reads as though a prop switched, which is a lie
 * about the API: there is no `size` prop to pass. It also hides one of the two entry points
 * from anyone scanning the sidebar for what they can call.
 *
 * HOW IT DECIDES. A state whose `name` looks like a component reference rather than a data
 * condition: `Something.Member` in PascalCase, or a name equal to the panel's own subject.
 * A real state name reads `discounted = 1490000` or `seatsRemaining = null`, so it carries an
 * `=`, a number, or plain prose, never a bare dotted identifier.
 */
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(process.argv[2] ?? ".storybook")

const walk = (d, out = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) { if (e.name !== "_legacy" && e.name !== "node_modules") walk(p, out) }
        else if (e.name.endsWith(".stories.tsx")) out.push(p)
    }
    return out
}

/** `Foo.Bar` / `Foo.Bar.Baz`, nothing else: no `=`, no digits, no spaces. */
const LOOKS_LIKE_MEMBER = /^[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)+$/

const findings = []
let seen = 0

for (const file of walk(ROOT)) {
    const src = fs.readFileSync(file, "utf8")
    const rel = path.relative(process.cwd(), file).split(path.sep).join("/")
    const lines = src.split("\n")

    // ⚠️ Only names INSIDE a `states={[ ... ]}` array count. The first pass matched every
    // `name:` in the file, so it swept up the `parts` tree as well and reported
    // `SurfaceCard.Base` and `Stack.H` as offenders. Those are correct: a STRUCTURE node is
    // supposed to be named after its component, and only a STATE must read as a data
    // condition. Measured 2026-07-27, that one mistake produced 58 reports.
    let subject = null
    let bracket = 0
    let inStates = false
    lines.forEach((line, i) => {
        if (/states=\{\[/.test(line)) { inStates = true; bracket = 0 }
        if (inStates) {
            bracket += (line.match(/\[/g) ?? []).length - (line.match(/\]/g) ?? []).length
            if (bracket <= 0 && !/states=\{\[/.test(line)) inStates = false
        }
        const s = line.match(/name="([^"]+)"/)
        if (s) subject = s[1]
        if (!inStates) return
        const m = line.match(/^\s*name:\s*"((?:[^"\\]|\\.)*)"/)
        if (!m) return
        seen++
        const name = m[1]
        if (LOOKS_LIKE_MEMBER.test(name) || (subject && name === subject)) {
            findings.push({ rel, line: i + 1, name, subject })
        }
    })
}

console.log(`state names scanned: ${seen}`)
console.log(`states that name a MEMBER instead of a data condition: ${findings.length}\n`)

const byFile = new Map()
for (const f of findings) byFile.set(f.rel, [...(byFile.get(f.rel) ?? []), f])
for (const [f, rows] of [...byFile].sort()) {
    console.log(`  ${f}`)
    for (const r of rows) console.log(`     :${r.line}  ${r.name}`)
}
if (findings.length) console.log(`\nSplit each into its OWN leaf (its own \`export const\` story).`)

process.exit(findings.length ? 1 : 0)
