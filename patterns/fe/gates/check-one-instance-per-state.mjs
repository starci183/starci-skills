#!/usr/bin/env node
/**
 * GATE — one state renders ONE instance of the component being examined.
 *
 * WHY. A state is a claim about the component under one condition. The moment a state
 * paints five buttons side by side to show off a prop union, three things break at once:
 * the `why` has to describe five things so it describes none of them precisely, the `code`
 * stops being copy-and-run, and the story has to hand roll `flex flex-wrap gap-3` to line
 * them up. That hand rolled flex is the tell. It is never the cause, it is what a state
 * carrying more than one claim forces you to write.
 *
 * WHAT IS ALLOWED. Rendering many rows because DATA came back with many rows is a normal
 * state (rules/2 §8: 0 / 1-3 / many / null). The violation is many instances of the SAME
 * component differing only by a PROP, which is a union dump, not a state.
 *
 * HOW IT DECIDES. Inside one state's `render:` we count the opening tags of the subject
 * component (the `name=` given to BlockAnatomy). More than one is reported. A `.map(` over
 * a screaming-case constant is reported with higher confidence because that is the exact
 * shape of a union dump.
 *
 * ⚠️ Heuristic, on purpose. It reads JSX as text, so it will not catch a union dumped
 * through a helper. Treat a green run as "no obvious dump", never as proof.
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

/** Slice the balanced `states={[ ... ]}` array so nested braces do not cut it short. */
const sliceStates = (src, from) => {
    const open = src.indexOf("[", from)
    if (open === -1) return null
    let depth = 0
    for (let i = open; i < src.length; i++) {
        const c = src[i]
        if (c === "[") depth++
        else if (c === "]") { depth--; if (depth === 0) return src.slice(open, i + 1) }
    }
    return null
}

/** Split one states array into its top-level `{ ... }` entries. */
const splitEntries = (arr) => {
    const out = []
    let depth = 0, start = -1
    for (let i = 0; i < arr.length; i++) {
        const c = arr[i]
        if (c === "{") { if (depth === 0) start = i; depth++ }
        else if (c === "}") { depth--; if (depth === 0 && start >= 0) out.push(arr.slice(start, i + 1)) }
    }
    return out
}

const findings = []
let statesSeen = 0

for (const file of walk(ROOT)) {
    const src = fs.readFileSync(file, "utf8")
    const rel = path.relative(process.cwd(), file).split(path.sep).join("/")

    // EVERY BlockAnatomy in the file, not just the first. A single stories file holds one
    // story per leaf (Button.Base has 23), so stopping at the first subject scanned 1/23 of
    // the work and reported green. Caught 2026-07-27 by the count itself: 136 states across
    // 1359 stories was too few to be true.
    const subjects = [...src.matchAll(/name="([^"]+)"/g)]
    for (let si = 0; si < subjects.length; si++) {
        const m = subjects[si]
        const subject = m[1]
        const at = src.indexOf("states={", m.index)
        if (at === -1) continue
        // The states array must belong to THIS BlockAnatomy, not the next one down the file.
        const nextSubjectAt = si + 1 < subjects.length ? subjects[si + 1].index : src.length
        if (at > nextSubjectAt) continue
        const arr = sliceStates(src, at)
        if (!arr) continue

        // The bare component, e.g. `Button.Base` -> `<Button.Base`
        const tag = "<" + subject.split(" ")[0]

        for (const entry of splitEntries(arr)) {
            statesSeen++
            const render = entry.slice(entry.indexOf("render:"))
            if (!render) continue
            const name = (entry.match(/name:\s*"((?:[^"\\]|\\.)*)"/) ?? [, "?"])[1]
            const instances = render.split(tag).length - 1

            // ⚠️ Counting tags is NOT enough. A `.map()` renders N instances from a SINGLE tag
            // in the source, so tag counting is blind to the most common union dump there is.
            // Proven by negative control 2026-07-27: an injected `PLACEMENTS.map(...)` scored
            // instances = 1 and sailed straight through. The story that started this whole
            // thread (`Button` Variants) had exactly that shape, and a human caught it, not
            // this gate.
            // ⚠️ v1 asked only "is there a `.map(` somewhere AND a SCREAMING_CASE token
            // somewhere". The two never had to be related, so it fired on a `.map` over six
            // literal filler strings while an unrelated `SAVE_ITEMS` sat elsewhere in the same
            // render. Measured 2026-07-27: 4 of 11 reports were false, and a gate that cannot go
            // green teaches people to bypass gates.
            //
            // v2 asks the question that actually separates the two cases: WHAT is in the array?
            //   • array of STRING LITERALS  -> those are prop values. `["sm","md","lg"]` is a
            //     union being paraded, so every element becomes another instance of the subject.
            //   • array of OBJECTS          -> that is content. `[{label,value}, …]` is four
            //     stats living in one card, which is what the component is FOR.
            // The constant is resolved in the file, so the decision rests on the data itself
            // rather than on the shape of the call site.
            const mapped = [...render.matchAll(/\b([A-Z][A-Z_0-9]{2,})\s*\.map\(/g)].map((x) => x[1])
            const isUnionArray = (id) => {
                const decl = src.match(new RegExp("const\\s+" + id + "\\b[^=]*=\\s*\\[([\\s\\S]{0,400}?)\\]", ""))
                if (!decl) return false
                const first = decl[1].trim()
                return first.startsWith('"') || first.startsWith("'")
            }
            const mapsUnion = mapped.some(isUnionArray)

            // A name still carrying ` | ` is the cheapest tell of all: the author is describing
            // several conditions at once, which IS more than one state. It also catches dumps
            // hidden behind a helper, where reading the render tells you nothing.
            const namePacksConditions = / \| /.test(name)

            const isDump = mapsUnion || namePacksConditions
            if (isDump || instances > 1) {
                findings.push({ rel, subject, name, instances, isDump })
            }
        }
    }
}

const dumps = findings.filter((f) => f.isDump)
const others = findings.filter((f) => !f.isDump)

console.log(`states scanned: ${statesSeen}`)
console.log(`states rendering >1 instance: ${findings.length}  (union dump: ${dumps.length}, other: ${others.length})\n`)

const show = (rows, title) => {
    if (!rows.length) return
    console.log(title)
    const byFile = new Map()
    for (const r of rows) byFile.set(r.rel, [...(byFile.get(r.rel) ?? []), r])
    for (const [f, rs] of [...byFile].sort()) {
        console.log(`  ${f}`)
        for (const r of rs) console.log(`     x${r.instances}  ${r.name.slice(0, 70)}`)
    }
    console.log("")
}

show(dumps, "UNION DUMP (maps a union constant, or the name packs several conditions):")
show(others, "MANY INSTANCES (check by hand, data-driven rows are legitimate):")

// ⭐ Fail on UNION DUMPS only. The "many instances" list is data driven rendering, which the
// canon explicitly allows (rules/2 §8: 0 / 1-3 / many / null), so failing on it would make the
// gate impossible to wire: it would block every commit for something that is not a defect.
// A gate that can never go green teaches people to bypass gates.
if (dumps.length) {
    console.log(`FAIL: ${dumps.length} union dump(s). Split each into one state per value.`)
    process.exit(1)
}
console.log("OK: no union dumps." + (others.length ? ` (${others.length} data-driven multi-render, allowed)` : ""))

