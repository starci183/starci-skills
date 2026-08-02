import type { TestRunnerConfig, TestContext } from "@storybook/test-runner"
import type { Page } from "playwright"
import { PATTERNS, PROP_READS } from "./test-runner/patterns.mjs"

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * RENDERED-TREE AUDIT — a DOM assertion, not a source regex.
 *
 * Every gate in this system today (`scripts/check-seams.mjs`, `check-padding.mjs`, …) reads
 * SOURCE. In one session that style of gate produced roughly ten separate false readings: JSX
 * inside a `code:` string counted as real markup, a function signature swallowed whole, a
 * comment counted as usage. A regex cannot tell a string literal from a render, and a rule that
 * cannot tell them apart is a rule a `code:` prop can lie to.
 *
 * This file checks the same rules a different way: it reads the ACTUAL rendered tree — the one
 * a browser produced from real CSS, real `getComputedStyle`, real `scrollWidth` — after every
 * story visits. It cannot be fooled by a string that merely LOOKS like markup, because it never
 * reads text; it reads pixels and attributes the browser computed.
 *
 * Four checks, each aimed at something a source scan structurally cannot see:
 *
 *   1. TIER NESTING — `data-tier` / `data-component` read off every rendered node, checked
 *      against each tier's "may import" list (`elements/atom.md` ATOM-3/8, `frame.md` FRAME-3,
 *      `composite.md` COMPOSITE-3, `block.md` BLOCK-3, `layout.md` LAYOUT-3, `overlay.md`
 *      OVERLAY-3, `page.md` PAGE-3).
 *   2. THE SEAM IS ON THE SCALE — `getComputedStyle(frame).gap` must resolve to one of the eight
 *      `AllowedGap` pixel values (`principles/gap.md`), catching a hand-written gap wherever it
 *      was written, including places no source regex looks (a `style={{}}`, a third-party class,
 *      a computed value nothing greps for).
 *   3. ELLIPSIS ACTUALLY HAPPENS — a class is not evidence a truncation fired. `scrollWidth >
 *      clientWidth` with `text-overflow: ellipsis` computed is.
 *   4. THE RESPONSIVE SWITCH FIRES AT THE NAMED WIDTH — `principles/responsive.md`'s four
 *      `@app-*` container breakpoints, swept for real, not read off a prop.
 *
 * ⚠️ Every section below states, in its own header comment, the thing it CANNOT prove and why —
 * read those before trusting a green run to mean more than it does. The short version, for the
 * one that reaches furthest: nesting can be judged with certainty ONLY down to a `frame`, because
 * a frame's slot (`FRAME-9`) is DESIGNED to hold caller-injected content of any tier, and nothing
 * in the rendered DOM distinguishes "the frame's own file imports this" from "a page handed this
 * to the frame's `body`". That distinction lives in an import graph, not a render, so `frame` is
 * deliberately absent from `MAY_CONTAIN` below rather than asserted incorrectly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── the closed vocabularies, restated from the specs so this file has no source of truth of its
//    own — if a spec file changes these, this file is expected to go out of date loudly (a test
//    starts failing everywhere) rather than silently drift.

/** `elements/*.md` "At a glance" → tier, lowest first. Order only matters for readability here;
 *  legality is decided by `MAY_CONTAIN`, not by position in this array. */
const KNOWN_TIERS = ["atom", "frame", "composite", "block", "layout", "overlay", "page"] as const
type Tier = (typeof KNOWN_TIERS)[number]

/** Story scaffolding (`Gallery`/`Variant` in `.storybook/story-kit.tsx`) is marked
 *  `data-tier="fixture"` with deliberately no `data-component` — transparent to every check
 *  below: never a component that "forgot" its marker, never a tier boundary a nesting check
 *  should stop at. */
const TRANSPARENT_TIERS = new Set(["fixture"])

/**
 * `principles/gap.md` — the eight steps, restated as the PIXEL VALUE `getComputedStyle` reports
 * (root font-size 16px; the eight `GAP_CLASS` classes, in px: `gap-0`=0 `gap-1`=4 `gap-2`=8
 * `gap-3`=12 `gap-4`=16 `gap-6`=24 `gap-8`=32 `gap-12`=48). A rounded value within 1px of one of
 * these is accepted — sub-pixel drift from browser zoom, not a real off-scale value.
 *
 * Step 7 is 32px (`gap-8`), not 40 (`gap-10`) — the layout seam was pulled in one rung when the
 * scale was locked (thầy 2026-08-01). A story still rendering 40px is now off-scale, on purpose:
 * it forces the 56 pending `gap-10` sites to migrate rather than letting the old value pass.
 */
const ALLOWED_GAP_PX = [0, 4, 8, 12, 16, 24, 32, 48]

/**
 * `principles/responsive.md` — the four container breakpoints, in px. `--container-app-*` in
 * `src/app/globals.css` confirms the root font-size assumption (`40rem` ↔ `640px` etc.) — these
 * are not guessed, they are the same tokens the app's own CSS declares.
 */
const BREAKPOINT_PX = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const

/**
 * `elements/*.md` "may import" rows, restated as: which tiers may appear as the NEAREST
 * `data-tier` descendant of an element of this tier (nearest = walking down through untagged
 * wrappers and `fixture` scaffolding, stopping the instant a real tier is found — what is deeper
 * than that belongs to THAT descendant's own audit, not to this one).
 *
 * `frame` has NO entry here, on purpose — see the file header and the long comment above
 * {@link auditNesting}. Checking `frame`'s "may import: atoms" against slot content would flag
 * ordinary, correct composition (a page handing a `SurfaceCard` into a `Stack`'s `body`) as a
 * violation, because FRAME-9 explicitly designs the slot to hold whatever a caller composes —
 * the one thing a rendered tree cannot tell apart from a frame importing that shape itself.
 *
 * `atom: []` is `ATOM-3` ("may import: nothing") and is unconditionally checkable: an atom takes
 * no slot at all (`ATOM-1` — one element, nothing handed in), so anything found beneath it was
 * put there by the atom's OWN file, never by a caller. That is the one tier where "contains" and
 * "imports" are the same fact.
 */
const MAY_CONTAIN: Partial<Record<Tier, readonly Tier[]>> = {
    atom: [],
    composite: ["atom", "frame"],
    block: ["atom", "frame", "composite"],
    layout: ["frame", "composite"],
    overlay: ["frame", "composite"],
    page: ["frame", "composite", "block"],
}

// ── shared browser-side helpers (serialized into the page via `page.evaluate`, so these must be
//    self-contained — no closing over anything outside the function passed to `evaluate`).

/** True for anything inside the Storybook anatomy panel (`data-sb-anatomy-panel`, see
 *  `.storybook/preview.tsx`) — dev tooling, never the audited app tree. */
const IN_ANATOMY_PANEL = `
    (el) => {
        const panel = document.querySelector("[data-sb-anatomy-panel]")
        return panel ? panel.contains(el) : false
    }
`

type Finding = string

interface AuditResult {
    /** Fails the story's test. */
    hard: Finding[]
    /** Printed on a failure, or when `STARCI_AUDIT_VERBOSE` is set — never fails alone. */
    info: Finding[]
}

const empty = (): AuditResult => ({ hard: [], info: [] })

// ─────────────────────────────────────────────────────────────────────────────
// 1 — TIER NESTING (data-tier / data-component)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Two things, both read straight off the rendered tree:
 *
 *   a. every `data-tier` carries a `data-component`, and vice versa (the brief: "hard-coded,
 *      always on" — a marker that is sometimes half-written is worse than absent, it reads as
 *      compliance in a diff). Unknown tier VALUES are reported too, since a typo in the literal
 *      (`"atoms"` for `"atom"`) type-checks nowhere `as const` doesn't reach, but shows up here
 *      the moment the component actually renders.
 *
 *   b. `MAY_CONTAIN`, walked from every element whose tier owns an entry — see the constant's
 *      own comment for why `frame` is excluded and why this is nonetheless the correct home for
 *      `ATOM-3`/`ATOM-8`: an atom containing ANY tiered descendant is checked unconditionally,
 *      everywhere in the tree, not just in an atom's own story — because there is no slot
 *      mechanism by which legitimate content could have arrived there.
 */
async function auditNesting(page: Page): Promise<AuditResult> {
    const raw = await page.evaluate(`
        (() => {
            const inPanel = ${IN_ANATOMY_PANEL}
            const KNOWN = ${JSON.stringify(KNOWN_TIERS)}
            const TRANSPARENT = ${JSON.stringify([...TRANSPARENT_TIERS])}
            const MAY_CONTAIN = ${JSON.stringify(MAY_CONTAIN)}

            /** Breadcrumb for a finding: the chain of tiered ancestors, root to el, for locating
             *  the node in a story that renders more than one thing. */
            const tierPath = (el) => {
                const parts = []
                let n = el
                while (n) {
                    const t = n.getAttribute && n.getAttribute("data-tier")
                    if (t) parts.unshift(t + ":" + (n.getAttribute("data-component") || "?"))
                    n = n.parentElement
                }
                return parts.join(" > ")
            }

            const pairing = []
            const unknownTier = []
            const all = Array.from(document.querySelectorAll("[data-tier], [data-component]"))
                .filter((el) => !inPanel(el))

            for (const el of all) {
                const tier = el.getAttribute("data-tier")
                const comp = el.getAttribute("data-component")
                if (tier && TRANSPARENT.includes(tier)) continue // fixture: no pairing required
                if (tier && !KNOWN.includes(tier)) {
                    unknownTier.push(tier + " (component=" + (comp ?? "none") + ") at " + tierPath(el))
                    continue
                }
                if (tier && !comp) pairing.push("data-tier=\\"" + tier + "\\" with no data-component at " + tierPath(el))
                if (!tier && comp) pairing.push("data-component=\\"" + comp + "\\" with no data-tier at " + tierPath(el))
            }

            /** Nearest tiered descendants of \`el\`: walk down, skipping untagged wrappers and
             *  \`fixture\` scaffolding, and stop the branch the instant a REAL tier is found —
             *  what is deeper than that is that descendant's own subtree, audited on its own
             *  turn when the outer loop below reaches it directly. */
            const nearestTieredDescendants = (el) => {
                const out = []
                const walk = (node) => {
                    for (const child of Array.from(node.children)) {
                        const t = child.getAttribute("data-tier")
                        if (t && !TRANSPARENT.includes(t)) {
                            out.push(child)
                            continue // do not descend past a real tier boundary
                        }
                        walk(child) // untagged wrapper or fixture scaffolding: keep looking
                    }
                }
                walk(el)
                return out
            }

            const nesting = []
            for (const [tier, allowed] of Object.entries(MAY_CONTAIN)) {
                const els = Array.from(document.querySelectorAll('[data-tier="' + tier + '"]'))
                    .filter((el) => !inPanel(el))
                for (const el of els) {
                    for (const d of nearestTieredDescendants(el)) {
                        const dTier = d.getAttribute("data-tier")
                        if (!allowed.includes(dTier)) {
                            nesting.push(
                                tier + ":" + (el.getAttribute("data-component") || "?") +
                                " contains " + dTier + ":" + (d.getAttribute("data-component") || "?") +
                                " — not in its allowed set [" + allowed.join(", ") + "]" +
                                " — at " + tierPath(el)
                            )
                        }
                    }
                }
            }

            return { pairing, unknownTier, nesting }
        })()
    `)

    const result = raw as { pairing: string[]; unknownTier: string[]; nesting: string[] }
    return {
        hard: [...result.pairing, ...result.unknownTier, ...result.nesting],
        info: [],
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 — THE SEAM IS ON THE SCALE (getComputedStyle(frame).gap)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Only checked when a frame HAS a concrete gap (`rowGap`/`columnGap` resolve to a real px value,
 * not the browser's `"normal"`). `Container` is a real frame with no seam concept at all — it
 * centres and pads ONE `body`, nothing to space apart — so an unset gap is not itself a finding;
 * an OFF-SCALE one is, wherever it came from.
 */
async function auditGapScale(page: Page): Promise<AuditResult> {
    const raw = await page.evaluate(`
        (() => {
            const inPanel = ${IN_ANATOMY_PANEL}
            const ALLOWED = ${JSON.stringify(ALLOWED_GAP_PX)}
            const nearestAllowed = (px) => ALLOWED.find((v) => Math.abs(v - px) <= 1)

            const hard = []
            const frames = Array.from(document.querySelectorAll('[data-tier="frame"]'))
                .filter((el) => !inPanel(el))

            for (const el of frames) {
                const style = getComputedStyle(el)
                const label = "frame:" + (el.getAttribute("data-component") || "?")
                for (const [axis, value] of [["row-gap", style.rowGap], ["column-gap", style.columnGap]]) {
                    if (value === "normal") continue // no gap concept for this frame — fine
                    const px = parseFloat(value)
                    if (Number.isNaN(px)) continue
                    if (nearestAllowed(px) === undefined) {
                        hard.push(label + " computed " + axis + "=" + value + " — off the eight-step gap scale " + JSON.stringify(ALLOWED))
                    }
                }
            }
            return { hard }
        })()
    `)

    const result = raw as { hard: string[] }
    return { hard: result.hard, info: [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 — ELLIPSIS ACTUALLY HAPPENS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * `text-overflow: ellipsis` present in computed style is the class DOING ITS JOB only when
 * `scrollWidth > clientWidth` on the SAME element. Two other outcomes exist, and only one of
 * them is a bug:
 *
 *   - the element's row/column ancestor is ALSO overflowing (`scrollWidth > clientWidth` on the
 *     nearest flex/grid ancestor) — the label never got a bounded box to truncate INSIDE, so the
 *     row grew instead. This is the classic missing `min-w-0` on a flex child, and it is a real
 *     finding: the ellipsis class is present and inert.
 *   - neither the label nor its row overflows — this story's content is simply short enough not
 *     to need truncation right now. Not a finding; also not something this check can call a
 *     PASS, because it never observed the class fire. Recorded as `info`, never `hard`.
 */
async function auditEllipsis(page: Page): Promise<AuditResult> {
    const raw = await page.evaluate(`
        (() => {
            const inPanel = ${IN_ANATOMY_PANEL}
            const FLEXY = new Set(["flex", "inline-flex", "grid", "inline-grid"])

            const hard = []
            const info = []
            const all = Array.from(document.querySelectorAll("*")).filter((el) => !inPanel(el))

            for (const el of all) {
                const style = getComputedStyle(el)
                if (style.textOverflow !== "ellipsis") continue
                if (el.clientWidth === 0 && el.scrollWidth === 0) continue // not actually rendered

                const label = el.tagName.toLowerCase() +
                    (el.getAttribute("data-anat-part") ? "[" + el.getAttribute("data-anat-part") + "]" : "") +
                    ' text="' + (el.textContent || "").slice(0, 40) + '"'

                if (el.scrollWidth > el.clientWidth + 1) {
                    continue // confirmed truncating — nothing to report
                }

                let ancestor = el.parentElement
                let rowOverflowing = false
                while (ancestor) {
                    const aStyle = getComputedStyle(ancestor)
                    if (FLEXY.has(aStyle.display)) {
                        rowOverflowing = ancestor.scrollWidth > ancestor.clientWidth + 1
                        break
                    }
                    ancestor = ancestor.parentElement
                }

                if (rowOverflowing) {
                    hard.push(
                        label + " has text-overflow:ellipsis but did not truncate — its row overflowed " +
                        "instead (scrollWidth > clientWidth on the nearest flex/grid ancestor), the " +
                        "classic missing min-w-0 on a flex child"
                    )
                } else {
                    info.push(label + " — text-overflow:ellipsis present, content fits at this width; truncation not exercised by this story")
                }
            }
            return { hard, info }
        })()
    `)

    const result = raw as { hard: string[]; info: string[] }
    return result
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 — THE RESPONSIVE SWITCH FIRES AT THE NAMED WIDTH
// ─────────────────────────────────────────────────────────────────────────────
/**
 * What this proves: every shape change any `[data-tier="frame"]` makes across the whole
 * 320px–1440px range happens AT one of the four `@app-*` edges (640/768/1024/1280) and NOWHERE
 * ELSE. That directly catches both things FRAME-10 forbids:
 *
 *   - a boolean/content-driven threshold (`wrap`, a JS `ResizeObserver` guess) — its change point
 *     depends on THIS story's text/font/translation, so it will essentially never land exactly on
 *     a named edge, and this sweep will find it wherever it actually falls.
 *   - a viewport breakpoint or an arbitrary class (`@app-[733px]`) — same signature, a change at
 *     a width that is real but not one of the four.
 *
 * What this does NOT prove: that a GIVEN frame changes at the RIGHT one of the four — that a
 * component documented as switching at `lg` doesn't actually switch at `md` instead. Confirming
 * THAT needs the prop the story passed (source), matched against the width the DOM changed at
 * (here) — this file has the second half only. Cross-referencing the two is listed under "could
 * not verify" in the report this task asks for.
 *
 * Sampled at ten widths — both edges of each of the four breakpoints, plus one point inside each
 * of the five bands they create — rather than every pixel, because a container query's change is
 * a step function: if the shape is identical at both ends of a band, it is identical throughout
 * it (nothing else in this system moves the breakpoint mid-band). Ten resizes is cheap; sweeping
 * the full range at fine granularity, for every story, is not, and isn't needed to prove the
 * step-function property — see the "could not verify" note on cost in the final report.
 */
const SWEEP_WIDTHS = [320, 639, 640, 767, 768, 1023, 1024, 1279, 1280, 1440]
/** Band pairs that must be IDENTICAL — no legal breakpoint sits inside them. */
const WITHIN_BAND_PAIRS: Array<[number, number]> = [
    [320, 639],
    [640, 767],
    [768, 1023],
    [1024, 1279],
    [1280, 1440],
]

const COLLECT_FRAME_SIGNATURES = `
    (() => {
        const inPanel = ${IN_ANATOMY_PANEL}
        const frames = Array.from(document.querySelectorAll('[data-tier="frame"]')).filter((el) => !inPanel(el))
        return frames.map((el) => {
            const s = getComputedStyle(el)
            return [s.display, s.flexDirection, s.flexWrap, s.gridTemplateColumns.split(" ").length, s.justifyContent].join("|")
        })
    })()
`

async function settle(page: Page) {
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
}

async function auditResponsiveSwitch(page: Page): Promise<AuditResult> {
    const hasFrames = await page.evaluate(`document.querySelector('[data-tier="frame"]') !== null`)
    if (!hasFrames) {
        return { hard: [], info: ["no [data-tier=\"frame\"] elements in this story — responsive sweep skipped"] }
    }

    const original = page.viewportSize() ?? { width: 1280, height: 800 }
    const bySignature = new Map<number, string[]>()

    try {
        for (const width of SWEEP_WIDTHS) {
            await page.setViewportSize({ width, height: original.height })
            await settle(page)
            const sigs = (await page.evaluate(COLLECT_FRAME_SIGNATURES)) as string[]
            bySignature.set(width, sigs)
        }
    } finally {
        await page.setViewportSize(original)
    }

    const hard: Finding[] = []
    const info: Finding[] = []
    const countFrames = bySignature.get(SWEEP_WIDTHS[0])?.length ?? 0

    for (let i = 0; i < countFrames; i++) {
        for (const [lo, hi] of WITHIN_BAND_PAIRS) {
            const loSig = bySignature.get(lo)?.[i]
            const hiSig = bySignature.get(hi)?.[i]
            if (loSig === undefined || hiSig === undefined) continue
            if (loSig !== hiSig) {
                // Pin down the exact width with a short binary search inside the offending band —
                // only runs when a band already disagrees, so the common (compliant) case never
                // pays for it.
                const pinned = await binarySearchChange(page, lo, hi, i)
                hard.push(
                    `frame #${i} changed shape between ${lo}px and ${hi}px` +
                    (pinned ? ` (at ${pinned}px)` : "") +
                    ` — no @app-* breakpoint sits inside that band, so this is either a content-driven ` +
                    `threshold (FRAME-10's boolean case) or a class-buried width, not the named switch`
                )
            }
        }
    }

    if (countFrames === 0) {
        info.push("frame(s) present but produced no comparable signature — see raw result")
    }

    return { hard, info }
}

/** Binary search between two widths whose frame-signature at index `i` differs, to report the
 *  pixel where it changes rather than only the band. Bounded to ~7 resizes (log2 of a ≤320px
 *  band) — cheap because it only ever runs on a band already known to disagree. */
async function binarySearchChange(page: Page, lo: number, hi: number, index: number): Promise<number | undefined> {
    const original = page.viewportSize() ?? { width: 1280, height: 800 }
    const sigAt = async (width: number) => {
        await page.setViewportSize({ width, height: original.height })
        await settle(page)
        const sigs = (await page.evaluate(COLLECT_FRAME_SIGNATURES)) as string[]
        return sigs[index]
    }

    let a = lo
    let b = hi
    const sigA = await sigAt(a)
    // `hi` is a valid (if unrefined) answer from the start — the caller only invokes this when
    // `sig(hi) !== sig(lo)`, so the true change point is somewhere in (lo, hi]. The loop below
    // narrows it; if every interior midpoint happens to still match `sigA`, `b` never moves off
    // `hi` and this default is the correct, un-refined answer rather than `undefined`.
    let result: number | undefined = hi
    while (b - a > 1) {
        const mid = Math.floor((a + b) / 2)
        const sigMid = await sigAt(mid)
        if (sigMid === sigA) {
            a = mid
        } else {
            b = mid
            result = mid
        }
    }
    await page.setViewportSize(original)
    return result
}

// ─────────────────────────────────────────────────────────────────────────────
// wiring
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 5 — EVERY DECLARED PATTERN COMPUTES ITS VALUE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * `auditGapScale` above proves a frame's gap is SOME value on the scale. This proves the stronger
 * thing: that a layout decision the source NAMED is the value that name means. A container marked
 * `data-principles="flex-action"` must compute an 8px gap; one marked `data-principles="card-padding"`
 * must compute 16px padding. "On the scale" would pass a control row at 24px as happily as at 8px —
 * only the pattern catches a value that is on the ladder but on the wrong rung, and it catches the
 * WRONG-PROPERTY case a gap-only check cannot see at all.
 *
 * `data-principles` is space-separated tokens, like `class` — one element usually makes several layout
 * decisions (pads itself AND sets the gap between its groups), so it declares each. The registry
 * `patterns.mjs` says, per token, which property to read (`gap` / `padding` / `margin`) and the
 * value it must be. This file needs no table of components: it reads every `data-principles` the story
 * rendered and measures the box the browser produced.
 *
 * An unknown token — a typo, or a pattern nobody registered — is a hard finding on its own: a marker
 * the registry cannot resolve is a claim nothing checks.
 */
async function auditPatterns(page: Page): Promise<AuditResult> {
    const raw = await page.evaluate(`
        (() => {
            const inPanel = ${IN_ANATOMY_PANEL}
            const CONCEPTS = ${JSON.stringify(PATTERNS)}
            const READS = ${JSON.stringify(PROP_READS)}
            const hard = []
            const info = []

            const marked = Array.from(document.querySelectorAll('[data-principles]')).filter((el) => !inPanel(el))
            for (const el of marked) {
                const style = getComputedStyle(el)
                const tokens = (el.getAttribute("data-principles") || "").split(/\\s+/).filter(Boolean)
                const px = (v) => parseFloat(v)
                for (const name of tokens) {
                    const concept = CONCEPTS[name]
                    if (!concept) {
                        hard.push('data-principles token "' + name + '" is not in patterns.mjs — a claim nothing can check')
                        continue
                    }
                    const prop = concept.prop

                    // gap / padding — symmetric px: every measured axis/side must be the concept's
                    // step, and 'normal' (no gap set) is simply nothing to measure, not a failure.
                    if (prop === "gap" || prop === "padding") {
                        const reads = READS[prop] || []
                        const measured = reads.map((k) => style[k]).filter((v) => v && v !== "normal").map(px).filter((n) => !Number.isNaN(n))
                        if (measured.length === 0) { info.push(name + ": declares it but has no " + prop + " to measure"); continue }
                        if (measured.find((n) => Math.abs(n - concept.px) > 1) !== undefined) {
                            hard.push(name + " (" + concept.what + "): " + prop + " computes " + measured.join("/") + "px, the concept is step " + concept.step + " = " + concept.px + "px")
                        }
                        continue
                    }

                    // padding-xy — the dominant real shape (px ≠ py). x-sides checked against
                    // concept.x, y-sides against concept.y; a symmetric box here is the mismatch.
                    if (prop === "padding-xy") {
                        const xs = READS["padding-xy"].x.map((k) => px(style[k])).filter((n) => !Number.isNaN(n))
                        const ys = READS["padding-xy"].y.map((k) => px(style[k])).filter((n) => !Number.isNaN(n))
                        const badX = xs.find((n) => Math.abs(n - concept.x) > 1) !== undefined
                        const badY = ys.find((n) => Math.abs(n - concept.y) > 1) !== undefined
                        if ((xs.length || ys.length) && (badX || badY)) {
                            hard.push(name + " (" + concept.what + "): padding computes x=" + xs.join("/") + " y=" + ys.join("/") + "px, the concept is x=" + concept.x + " y=" + concept.y + "px")
                        }
                        continue
                    }

                    // overflow — a reel scrolls; auto and scroll both satisfy an 'auto' concept.
                    if (prop === "overflow") {
                        const v = style[READS.overflow[concept.axis]]
                        const ok = v === concept.value || (concept.value === "auto" && (v === "auto" || v === "scroll"))
                        if (!ok) hard.push(name + " (" + concept.what + "): overflow-" + concept.axis + " computes '" + v + "', the concept expects '" + concept.value + "'")
                        continue
                    }

                    // position — sticky / fixed read straight back from computed style.
                    if (prop === "position") {
                        if (style.position !== concept.value) hard.push(name + " (" + concept.what + "): position computes '" + style.position + "', the concept expects '" + concept.value + "'")
                        continue
                    }

                    // margin:auto — DELIBERATELY not asserted. getComputedStyle reports the USED px an
                    // 'auto' margin resolved to, never the string 'auto', so the concept is unrecoverable
                    // from the rendered box. Recorded honestly rather than checked against a value the
                    // DOM does not expose — like the ellipsis 'content fits' case, present-but-unprovable.
                    if (prop === "margin") { info.push(name + ": margin '" + concept.value + "' does not survive into computed style (auto → used px) — not asserted here"); continue }

                    // breakpoint — the responsive-switch sweep owns this, not a single computed value.
                    if (prop === "breakpoint") { info.push(name + ": a responsive switch — asserted by the sweep, not measured here"); continue }

                    info.push(name + ": prop '" + prop + "' has no measurement rule in this audit")
                }
            }
            return { hard, info }
        })()
    `)

    const result = raw as { hard: string[]; info: string[] }
    return { hard: result.hard, info: result.info }
}

function formatReport(context: TestContext, results: Record<string, AuditResult>, hard: Finding[]): string {
    const lines: string[] = [`Rendered-tree audit failed for "${context.title} / ${context.name}":`, ""]
    for (const [name, r] of Object.entries(results)) {
        if (r.hard.length) {
            lines.push(`── ${name} (${r.hard.length}) ──`)
            for (const f of r.hard) lines.push(`  ✗ ${f}`)
            lines.push("")
        }
    }
    if (process.env.STARCI_AUDIT_VERBOSE) {
        for (const [name, r] of Object.entries(results)) {
            if (r.info.length) {
                lines.push(`── ${name}: not assertable from the DOM (${r.info.length}) ──`)
                for (const f of r.info) lines.push(`  · ${f}`)
                lines.push("")
            }
        }
    }
    lines.push(`${hard.length} hard finding(s).`)
    return lines.join("\n")
}

const config: TestRunnerConfig = {
    async postVisit(page: Page, context: TestContext) {
        const results: Record<string, AuditResult> = {
            "tier nesting": empty(),
            "gap scale": empty(),
            patterns: empty(),
            ellipsis: empty(),
            "responsive switch": empty(),
        }

        results["tier nesting"] = await auditNesting(page)
        results["gap scale"] = await auditGapScale(page)
        results["patterns"] = await auditPatterns(page)
        results["ellipsis"] = await auditEllipsis(page)
        // Last, because it deliberately resizes the viewport mid-test. It restores the original
        // size in its own `finally`, but running it before the cheaper, non-mutating checks would
        // make a viewport-resize bug in this file harder to tell apart from a real finding in
        // the other three.
        results["responsive switch"] = await auditResponsiveSwitch(page)

        const hard = Object.values(results).flatMap((r) => r.hard)
        if (hard.length) {
            throw new Error(formatReport(context, results, hard))
        }
    },
}

export default config
