#!/usr/bin/env node
/**
 * GATE — nothing may be badged and then left out of the tree.
 *
 * WHY THIS IS DIFFERENT FROM `check-deps-coverage`. That gate asks "what does this file
 * IMPORT that its story never declares". This one asks "what does this file BADGE that its
 * story never declares". Measured 2026-07-27, the import question reported 9 and the badge
 * question reported 153 across 56 files. Running only the easier question is how a tree keeps
 * looking complete while a real icon and a real button sit outside it, which is exactly what
 * the teacher spotted on `Feedback.Empty` after every other gate was green.
 *
 * The panel admits a part only when its annotation carries a real `storyId`, or when it is
 * marked `tier: "heroui"`. Anything badged without one of those renders in the DOM and is
 * invisible in the tree, silently.
 *
 * THREE KINDS OF OFFENDER, three different fixes. Do not sweep them together.
 *   1. A REAL COMPONENT of ours (`Button`, `Avatar`, `Chip`): declare it with its `storyId`.
 *   2. An INTERNAL part of an atom (`Skeleton`, `Dot`, `Remove`, `Cover`): the atom owns its
 *      own inner geometry (§13z), so either declare it as a named internal part or stop
 *      badging it. A badge that leads nowhere teaches the reader to distrust badges.
 *   3. A CALLER SLOT (`Body`, `Action`, `Content`): the node inside belongs to whoever passed
 *      it, not to the frame, so the frame should not claim it as a part of its own anatomy.
 */
import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(process.argv[2] ?? ".storybook")

const walk = (d, out = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) { if (e.name !== "_legacy" && e.name !== "node_modules") walk(p, out) }
        else if (e.name.endsWith(".tsx")) out.push(p)
    }
    return out
}
const rel = (f) => path.relative(process.cwd(), f).split(path.sep).join("/")

const stories = walk(path.join(ROOT, "stories"))
const comps = walk(path.join(ROOT, "components"))

const rows = []
let total = 0

for (const file of comps) {
    const src = fs.readFileSync(file, "utf8")

    // Only literal names the component itself emits. A name coming in through a prop belongs
    // to the caller and is that caller's job to declare.
    const emitted = new Set()
    for (const m of src.matchAll(/(?:anatPart|data-anat-part)=\{[^}]*?\?\s*"([^"]+)"/g)) emitted.add(m[1])
    if (!emitted.size) continue

    const fam = path.dirname(rel(file)).replace(/^.*\/components\//, "").replace(/^components\//, "")
    let mine = stories.filter((s) => path.dirname(rel(s)).replace(/^.*\/stories\//, "").replace(/^stories\//, "") === fam)
    // A shared ATOM-INTERNAL frame (e.g. `_field/FieldFrame`) legitimately has no story of its
    // own — its parts get badged by whichever consuming atom composes it (`Input.*`, `Choice.*`,
    // `Select.*`), which lives in a DIFFERENT family folder. Same-family lookup alone can't see
    // that declaration, so a family with zero stories falls back to the whole tree before being
    // called orphaned outright (2026-07-28 — was a false "NO STORY FILE" on `FieldFrame.tsx`).
    if (!mine.length) mine = stories

    const ss = mine.map((f) => fs.readFileSync(f, "utf8")).join("\n")
    const declared = new Set()
    for (const m of ss.matchAll(/"([^"]+)"\s*:\s*\{[^{}]*?(?:storyId:|tier:\s*"heroui")/gs)) declared.add(m[1])
    // `AnatomyNode` array style (`{ name: "X", tier: "heroui", role: … }`) — the same "no
    // storyId, heroui renders it directly" rule as the key-style map above, just written as
    // an array entry instead of an object key. Missing this made every `parts: Array<AnatomyNode>`
    // heroui-tier leaf (no sub-story to link to) read as undeclared even though it names a
    // real import with a role (ModalShell/Toolbar/MetricCard/SegmentBar/StatPair, 2026-07-28).
    for (const m of ss.matchAll(/name:\s*"([^"]+)"[^{}]*?(?:storyId:|tier:\s*"heroui")/gs)) declared.add(m[1])

    const miss = [...emitted].filter((n) => !declared.has(n))
    if (miss.length) { rows.push({ f: rel(file), miss }); total += miss.length }
}

console.log(`parts badged but left OUT of the tree: ${total}  (${rows.length} files)\n`)
for (const r of rows) console.log(`  ${r.f}${r.noStory ? "   (NO STORY FILE)" : ""}\n     ${r.miss.join(" · ")}`)
if (total) console.log(`\nDeclare it, or stop badging it. A badge that leads nowhere is worse than no badge.`)

process.exit(total ? 1 : 0)
