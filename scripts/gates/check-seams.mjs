#!/usr/bin/env node
/**
 * SEAM gate (§10). Three things nothing else catches, all measured from source:
 *
 *   1. LAYOUT DRAWN BY HAND above the layout tier — a `design`/`block`/`screen` component
 *      writing `flex`/`grid` + `gap-*` in a className instead of going through a frame
 *      (`Stack`/`Cluster`/`Grid`/`Container`). Hand-written spacing is invisible to the
 *      `SpaceScale` type, so it is the one place an off-scale step can still get in.
 *   2. A `gap` PASSED INTO a frame that already owns its own default. Two owners for one
 *      seam is what §10a forbids; the anchor is `KeyValue.List` (its default is the
 *      `grouped` step) being handed `gap={1}` from a design.
 *   3. OFF-SCALE steps: only `0 · 1 · 2 · 3 · 6 · 8` exist (§10c).
 *
 * It does NOT judge whether a seam is the RIGHT step — that needs the relationship between
 * the two things, which only a reader can see. Anchor for why: `PriceTag ↔ PhaseScarcityNote`
 * is `design ↔ design`, which the §10b matrix calls `section` (6), yet the scarcity line is a
 * CAPTION of the price, so the honest step is `grouped` (3). Applying the matrix mechanically
 * produced a 24/12/24/24 rhythm — uniform, which §10 bans. So: this gate reports FACTS about
 * ownership and scale; the step itself stays a judgement.
 *
 *   node scripts/check-seams.mjs         -> report (exit 1 on hand-rolled layout / off-scale)
 *   node scripts/check-seams.mjs --json  -> machine-readable
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = process.cwd()
const SB = join(ROOT, ".storybook")

/**
 * Frames that render THEIR OWN repeated rows from `items`, so the row rhythm is internal and
 * a caller handing them a `gap` is overriding it from outside.
 *
 * `Stack.*`/`Cluster`/`Grid`/`Container` are deliberately NOT here: those frames lay out
 * CALLER-PROVIDED children, and §10a says the seam between children belongs to the parent —
 * passing `gap` to them is the rule working, not a violation. The first version of this gate
 * listed them and reported 12 "violations" that were all correct code.
 */
const LIST_FRAMES = ["KeyValue.List", "SurfaceCard.List", "SurfaceCard.CrossList", "SurfaceCard.Accordion", "List.Labeled"]

/** Our own frames — a `gap={n}` prop is only on OUR scale when the tag is one of these. */
const OWN_FRAMES = [...LIST_FRAMES, "Stack.V", "Stack.H", "Cluster.Base", "Grid.Base", "Container.Base"]
/** §10c — the whole vocabulary of raw Tailwind steps still allowed in a className. */
const SCALE = new Set(["0", "1", "2", "3", "6", "8"])
/** §10c as the PROP says it: the seam is chosen by relationship, never by number. */
const SEAM_WORDS = new Set(["flush", "tight", "related", "grouped", "section", "page"])

const walk = (dir, out = []) => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry)
        if (statSync(path).isDirectory()) {
            walk(path, out)
        } else if (/\.tsx$/.test(entry)) {
            out.push(path)
        }
    }
    return out
}

/**
 * Which tier a file belongs to, read from the FOLDER NAME ON DISK — the only source that
 * cannot drift. Measured 2026-07-29, the previous version looked for `/screens/` and
 * `/designs/`, two folders that do not exist: `designs` was deleted and screens live under
 * `<app>/pages/`. Every page, layout and overlay therefore fell through to `util` and was
 * exempted by accident, so the rule below covered only `block` — 118 of 258 files, 46 percent.
 *
 * The shared tiers (`atoms` · `behaviors` · `frames` · `composites`) sit at the root; the
 * app-specific ones (`blocks` · `layouts` · `overlays` · `pages`) sit under an app folder,
 * so tier and app are two perpendicular axes and the tier name alone is enough here.
 *
 * `behaviors` is a headless primitive: measured, it imports nothing from `@sb-components` at
 * all and is consumed by blocks, layouts and pages. It draws no layout of its own, so it is
 * exempt from the hand-rolled rule for the same reason an atom is.
 */
const tierOf = (rel) =>
    rel.includes("/pages/") ? "page"
    : rel.includes("/overlays/") ? "overlay"
    : rel.includes("/layouts/") ? "layout"
    : rel.includes("/blocks/") ? "block"
    : rel.includes("/composites/") ? "composite"
    : rel.includes("/frames/") ? "frame"
    : rel.includes("/behaviors/") ? "behavior"
    : rel.includes("/atoms/") ? "atom"
    : "util"

/**
 * Tiers that must delegate layout to a frame instead of hand-rolling `flex`/`grid` + `gap-*`
 * (§13z). An atom, a behavior and a frame itself have nothing lower to delegate to, so they
 * are the only exemptions; everything from `composite` up owns composition, not geometry.
 */
const HAND_ROLL_RULED = ["composite", "block", "layout", "overlay", "page"]

const findings = []
/** Fractional steps in a file that declared the exception itself — shown, not failed. */
const exempt = []
const files = walk(SB).filter((f) => !f.includes("_legacy") && !f.includes(".stories."))

for (const file of files) {
    const rel = relative(ROOT, file).replaceAll("\\", "/")
    const tier = tierOf(rel)
    const source = readFileSync(file, "utf8")
    const declaresFractionalException = /eslint-disable[^\n]*no-fractional-spacing/.test(source)
    const lines = source.split("\n")
    let inBlockComment = false

    lines.forEach((line, index) => {
        const trimmed = line.trim()
        // A JSX comment opens with `{/*`, not `/*`. Missing that made the gate read the INSIDE
        // of a comment as code and report `ContinueCard.tsx` for "hand-rolled layout" — the
        // line it quoted was the comment explaining what the layout used to be.
        if (trimmed.startsWith("/*") || trimmed.startsWith("{/*")) inBlockComment = true
        const isComment = trimmed.startsWith("//") || inBlockComment || trimmed.startsWith("*")
        if (inBlockComment && trimmed.includes("*/")) inBlockComment = false
        if (isComment) return

        const at = { file: rel, line: index + 1, tier, code: trimmed.slice(0, 110) }

        // 1 — hand-rolled layout from the composite tier up (§13z: atom, behavior and frame may).
        if (HAND_ROLL_RULED.includes(tier)) {
            const cls = line.match(/className=(?:"([^"]*)"|\{cn\(\s*"([^"]*)")/)
            const value = cls?.[1] ?? cls?.[2]
            if (value && /\bgap-[\d.]+/.test(value) && /\b(flex|grid)\b/.test(value)) {
                findings.push({ ...at, rule: "hand-rolled-layout", detail: value.match(/(flex|grid)[^"]*/)?.[0] ?? value })
            }
        }

        // 3 — off-scale step, any tier. A file that has DECLARED the fractional exception in
        // its own eslint-disable is honoured rather than reported forever: `BlockAnatomy` is
        // dev tooling and says so at the top. Declared exceptions are counted in the summary
        // so they stay visible instead of disappearing.
        for (const [, step] of line.matchAll(/\bgap-(\d+(?:\.\d+)?)\b/g)) {
            if (SCALE.has(step)) continue
            if (declaresFractionalException && step.includes(".")) {
                exempt.push({ ...at, detail: `gap-${step}` })
                continue
            }
            findings.push({ ...at, rule: "off-scale", detail: `gap-${step}` })
        }
        // A NUMERIC `gap={n}` on one of our frames is now a violation whatever the number is:
        // since 2026-07-27 the seam prop takes a RELATIONSHIP word (`SeamScale`) and the number
        // is the old vocabulary. TypeScript already rejects it at our own call-sites, so this
        // branch exists for the places tsc cannot see — prose in `code:` snippets, `_legacy`
        // when it gets migrated, and any file a future `any` sneaks through.
        //
        // The tag check stays: `<Background gap={16}>` is ReactFlow's dot spacing in PIXELS, and
        // reading it as our token scale was a false positive in the first version of this gate.
        for (const [, step] of line.matchAll(/\bgap=\{(\d+(?:\.\d+)?)\}/g)) {
            const onOurFrame = OWN_FRAMES.some((frame) => line.includes(`<${frame}`))
            if (onOurFrame) findings.push({ ...at, rule: "numeric-seam", detail: `gap={${step}}` })
        }
        // An unknown WORD is the new off-scale: `gap="cosy"` type-checks nowhere but can still
        // be written into a `code:` snippet a reader will copy.
        for (const [, word] of line.matchAll(/\bgap="([a-z]+)"/g)) {
            if (!SEAM_WORDS.has(word)) findings.push({ ...at, rule: "off-scale", detail: `gap="${word}"` })
        }
    })

    // 2 — a `gap` handed to a frame that owns its own default. Needs the whole file: the JSX
    // opening tag and its `gap` prop are usually on different lines.
    const src = source
    for (const frame of LIST_FRAMES) {
        // Matches BOTH vocabularies on purpose: `gap="related"` is the current form and
        // `gap={2}` is the old one. Pinning this to `\d+` is what made the rule go quiet the
        // day the scale became words — it kept passing while nothing was being checked.
        const re = new RegExp(`<${frame.replace(".", "\\.")}\\b[^>]*?\\bgap=(?:\\{(\\d+)\\}|"([a-z]+)")`, "gs")
        for (const match of src.matchAll(re)) {
            const line = src.slice(0, match.index).split("\n").length
            findings.push({
                file: rel,
                line,
                tier,
                rule: "gap-into-frame",
                detail: `<${frame} gap=${match[1] ? `{${match[1]}}` : `"${match[2]}"`}>`,
                code: match[0].replace(/\s+/g, " ").slice(0, 110),
            })
        }
    }
}

if (process.argv.includes("--json")) {
    process.stdout.write(JSON.stringify(findings))
    process.exit(0)
}

const byRule = {}
for (const f of findings) byRule[f.rule] = (byRule[f.rule] ?? 0) + 1

const LABEL = {
    "hand-rolled-layout": "Bố cục viết TAY ở tầng design/block/screen — phải đi qua khung (§13z)",
    "numeric-seam": "Bậc seam ghi bằng SỐ — thang seam là QUAN HỆ (§10c)",
    "gap-into-frame": "Truyền `gap` VÀO khung tự sở hữu nhịp — 2 chủ 1 seam (§10a)",
    "off-scale": "Bậc ngoài thang `0·1·2·3·6·8` (§10c)",
}

console.log(`File impl quét: ${files.length} | phát hiện: ${findings.length} | ngoại lệ đã khai: ${exempt.length}`)
for (const [rule, count] of Object.entries(byRule)) console.log(`  ${String(count).padStart(3)}  ${LABEL[rule] ?? rule}`)

// Iterate the rules that ACTUALLY fired rather than a hand-kept list. The list version printed
// "✗ 2 chỗ" while showing only one of them, because `numeric-seam` was added to the checks and
// not to the list — a report that counts more than it shows teaches a reader to distrust it.
for (const rule of Object.keys(byRule)) {
    const rows = findings.filter((f) => f.rule === rule)
    if (!rows.length) continue
    console.log(`\n── ${LABEL[rule]}`)
    for (const f of rows) console.log(`  [${f.tier}] ${f.file}:${f.line}  ${f.detail}\n        ${f.code}`)
}

// `gap-into-frame` stays a WARNING: overriding a list frame's own row rhythm is usually wrong
// but not always — a denser financial table is a real case. It is reported so a reader decides,
// and the anchor to compare against is `KeyValue.List` (default `grouped`) once handed `gap={1}`.
const hard = findings.filter((f) => f.rule !== "gap-into-frame")
if (hard.length) {
    console.log(`\n✗ ${hard.length} chỗ phải sửa (bố cục tay / off-scale).`)
    process.exit(1)
}
console.log("\n✅ Không có bố cục viết tay ở tầng trên, không có bậc off-scale.")
