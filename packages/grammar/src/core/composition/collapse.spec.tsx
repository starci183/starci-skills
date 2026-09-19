import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PrimaryRailLayout } from "./PrimaryRailLayout/index.js"
import { WorkspaceShell } from "./WorkspaceShell/index.js"

/**
 * A COLLAPSE MAY NOT BE OUTRANKED.
 *
 * A container query adds no specificity of its own, so a collapse written as a bare class inside
 * one loses to any attribute selector written outside it. That is not a typo a reviewer catches -
 * it is invisible in every jsdom test, because jsdom evaluates no container query at all, and it
 * shipped: `PrimaryRailLayout` with `railWidth="wide"` kept its two-column form at 390px and the
 * primary track computed to 0px.
 *
 * The repair is structural rather than a longer list of overrides: the narrow form is the DEFAULT
 * and every wide form lives inside a `min-width` container query, so the two ranges are mutually
 * exclusive and no selector inside the query - at any specificity, on any attribute added later -
 * can reach the collapsed layout. These specs check that structure directly, by matching the
 * attributes each composition actually renders against the selectors the sheet actually contains.
 */

const css = readFileSync(new URL("../../common/styles.css", import.meta.url), "utf8")

type Rule = {
    readonly selector: string
    readonly body: string
    readonly conditions: ReadonlyArray<string>
}

type Box = {
    readonly classes: ReadonlyArray<string>
    readonly attributes: Readonly<Record<string, string>>
}

const collectRules = (source: string, conditions: ReadonlyArray<string>, into: Array<Rule>): void => {
    let prelude = ""
    let index = 0
    while (index < source.length) {
        const character = source[index]
        if (character === "{") {
            let depth = 1
            let end = index + 1
            while (end < source.length && depth > 0) {
                if (source[end] === "{") depth += 1
                if (source[end] === "}") depth -= 1
                end += 1
            }
            const body = source.slice(index + 1, end - 1)
            const head = prelude.trim()
            if (head.startsWith("@")) collectRules(body, [...conditions, head], into)
            else into.push({ selector: head, body, conditions })
            prelude = ""
            index = end
            continue
        }
        if (character === "}") {
            prelude = ""
            index += 1
            continue
        }
        prelude += character
        index += 1
    }
}

const rules: ReadonlyArray<Rule> = (() => {
    const collected: Array<Rule> = []
    collectRules(css.replace(/\/\*[\s\S]*?\*\//g, ""), [], collected)
    return collected
})()

/** One declared value, or `undefined`; these rules hold no nested block. */
const declarationOf = (body: string, property: string): string | undefined => {
    for (const part of body.split(";")) {
        const colon = part.indexOf(":")
        if (colon < 0) continue
        if (part.slice(0, colon).trim() !== property) continue
        return part.slice(colon + 1).trim()
    }
    return undefined
}

/** Top-level tokens of a track list: `var(--a) minmax(0, 1fr)` is two tracks, not four. */
const trackCount = (value: string): number => {
    let depth = 0
    let count = 0
    let inToken = false
    for (const character of value) {
        if (character === "(") depth += 1
        if (character === ")") depth -= 1
        if (depth === 0 && /\s/.test(character)) {
            inToken = false
            continue
        }
        if (!inToken) {
            inToken = true
            count += 1
        }
    }
    return count
}

/** `"navigation" "primary" "rail"` is one column; `"navigation primary rail"` is three. */
const areaColumnCount = (value: string): number => Math.max(
    ...[...value.matchAll(/"([^"]*)"/g)].map((row) => (row[1] ?? "").trim().split(/\s+/).filter(Boolean).length),
    0,
)

const boxWithClass = (markup: string, className: string): Box => {
    const tag = markup.match(new RegExp(`<[a-z]+[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>`))?.[0] ?? ""
    expect(tag, `rendered markup carries no .${className}`).not.toBe("")
    const attributes = Object.fromEntries([...tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((match) => [match[1] ?? "", match[2] ?? ""]))
    return { classes: (attributes["class"] ?? "").split(/\s+/).filter(Boolean), attributes }
}

/** Does one compound selector - never a descendant one - select this very box? */
const selects = (selector: string, box: Box): boolean => selector.split(",").some((part) => {
    const compound = part.trim()
    if (compound === "" || /[\s>+~]/.test(compound)) return false
    const classes = [...compound.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((match) => match[1] ?? "")
    if (classes.length === 0 || !classes.every((name) => box.classes.includes(name))) return false
    return [...compound.matchAll(/\[([a-zA-Z-]+)="([^"]*)"\]/g)].every((match) => box.attributes[match[1] ?? ""] === match[2])
})

const isContained = (rule: Rule): boolean => rule.conditions.some((condition) => condition.startsWith("@container"))

const matching = (box: Box, property: string) => rules.filter((rule) => declarationOf(rule.body, property) !== undefined && selects(rule.selector, box))

const primaryRailBox = (railWidth: "compact" | "standard" | "wide", collapsedOrder: "primary-first" | "rail-first"): Box => boxWithClass(
    renderToStaticMarkup(<PrimaryRailLayout collapsedOrder={collapsedOrder} primary={<p>Primary</p>} rail={<p>Rail</p>} railWidth={railWidth} />),
    "starci-core-primary-rail-layout",
)

describe("PrimaryRailLayout collapse", () => {
    const widths = ["compact", "standard", "wide"] as const
    const orders = ["primary-first", "rail-first"] as const

    it("gives every railWidth x collapsedOrder variant the single-column form outside the query", () => {
        for (const railWidth of widths) {
            for (const collapsedOrder of orders) {
                const box = primaryRailBox(railWidth, collapsedOrder)
                expect(box.attributes["data-grammar-layout-rail-width"]).toBe(railWidth)
                expect(box.attributes["data-grammar-layout-collapsed-order"]).toBe(collapsedOrder)
                expect(box.attributes["data-grammar-layout-rail"]).toBe("present")

                const uncontained = matching(box, "grid-template-columns").filter((rule) => !isContained(rule))
                expect(uncontained.map((rule) => rule.selector), `${railWidth}/${collapsedOrder} keeps a track list outside the container query`)
                    .toEqual([".starci-core-primary-rail-layout"])
                for (const rule of uncontained) {
                    expect(trackCount(declarationOf(rule.body, "grid-template-columns") ?? "")).toBe(1)
                }
            }
        }
    })

    it("keeps every two-column form inside the widening query, and none in the collapse", () => {
        const wide = rules.filter((rule) => rule.selector.includes(".starci-core-primary-rail-layout")
            && trackCount(declarationOf(rule.body, "grid-template-columns") ?? "") > 1)
        expect(wide.length).toBe(3)
        for (const rule of wide) {
            expect(rule.conditions).toContain("@container starci-core-primary-rail (min-width: 56.001rem)")
            expect(rule.selector, "a rail track is only owed to a layout that has a rail").toContain("[data-grammar-layout-rail=\"present\"]")
        }

        const collapse = rules.filter((rule) => rule.conditions.includes("@container starci-core-primary-rail (max-width: 56rem)"))
        expect(collapse.length).toBeGreaterThan(0)
        for (const rule of collapse) {
            expect(declarationOf(rule.body, "grid-template-columns"), "the collapse is the default, not an override").toBeUndefined()
        }
    })

    it("still lifts a rail-first rail above the primary once collapsed", () => {
        const order = rules.find((rule) => rule.selector.includes("data-grammar-layout-collapsed-order=\"rail-first\""))
        expect(order?.conditions).toContain("@container starci-core-primary-rail (max-width: 56rem)")
        expect(declarationOf(order?.body ?? "", "order")).toBe("-1")
    })
})

const workspaceShellBox = (props: {
    readonly navigation: boolean
    readonly rail: boolean
    readonly railPosition: "leading" | "trailing"
    readonly railWidth: "compact" | "standard" | "wide"
}): Box => boxWithClass(
    renderToStaticMarkup(
        props.navigation
            ? props.rail
                ? <WorkspaceShell navigation={<p>Nav</p>} navigationLabel="Nav" primary={<p>Body</p>} primaryLabel="Body" rail={<p>Rail</p>} railLabel="Rail" railPosition={props.railPosition} railWidth={props.railWidth} />
                : <WorkspaceShell navigation={<p>Nav</p>} navigationLabel="Nav" primary={<p>Body</p>} primaryLabel="Body" />
            : props.rail
                ? <WorkspaceShell primary={<p>Body</p>} primaryLabel="Body" rail={<p>Rail</p>} railLabel="Rail" railPosition={props.railPosition} railWidth={props.railWidth} />
                : <WorkspaceShell primary={<p>Body</p>} primaryLabel="Body" />,
    ),
    "starci-core-workspace-shell-layout",
)

describe("WorkspaceShell collapse", () => {
    const combinations = [true, false].flatMap((navigation) => [true, false].flatMap((rail) => (["leading", "trailing"] as const).flatMap((railPosition) => (["compact", "standard", "wide"] as const).map((railWidth) => ({ navigation, rail, railPosition, railWidth })))))

    it("stacks every navigation x rail x position x width combination outside the query", () => {
        for (const combination of combinations) {
            const box = workspaceShellBox(combination)
            const label = `${combination.navigation ? "nav" : "no-nav"}/${combination.rail ? combination.railPosition : "no-rail"}/${combination.railWidth}`

            for (const rule of matching(box, "grid-template-columns").filter((candidate) => !isContained(candidate))) {
                expect(trackCount(declarationOf(rule.body, "grid-template-columns") ?? ""), `${label} keeps ${rule.selector} multi-track outside the query`).toBe(1)
            }
            for (const rule of matching(box, "grid-template-areas").filter((candidate) => !isContained(candidate))) {
                expect(areaColumnCount(declarationOf(rule.body, "grid-template-areas") ?? ""), `${label} keeps ${rule.selector} side by side outside the query`).toBe(1)
            }
        }
    })

    it("owns the side-by-side tiers in two widening queries and the seam with them", () => {
        const side = rules.filter((rule) => rule.selector.includes(".starci-core-workspace-shell-layout")
            && areaColumnCount(declarationOf(rule.body, "grid-template-areas") ?? "") > 1)
        expect(side.length).toBe(6)
        for (const rule of side) {
            expect(rule.conditions.some((condition) => condition === "@container starci-core-workspace-shell (min-width: 56.001rem)"
                || condition === "@container starci-core-workspace-shell (min-width: 72.001rem)"), `${rule.selector} sits outside a widening tier`).toBe(true)
        }
        const seam = rules.find((rule) => rule.selector.includes("data-grammar-workspace-rail-position=\"leading\"")
            && rule.selector.includes(".starci-core-workspace-shell-primary"))
        expect(seam?.conditions).toContain("@container starci-core-workspace-shell (min-width: 56.001rem)")
    })
})

describe("The collapse law across every container-owned composition", () => {
    /** Class names any container query in the sheet takes an interest in. */
    const containerClasses = new Set(rules.filter(isContained).flatMap((rule) => [...rule.selector.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((match) => match[1] ?? "")))

    it("lets no rule outside a container query set a side-by-side grid on a collapsing class", () => {
        const offenders = rules.filter((rule) => !isContained(rule))
            .filter((rule) => [...rule.selector.matchAll(/\.([A-Za-z0-9_-]+)/g)].some((match) => containerClasses.has(match[1] ?? "")))
            .filter((rule) => trackCount(declarationOf(rule.body, "grid-template-columns") ?? "") > 1
                || areaColumnCount(declarationOf(rule.body, "grid-template-areas") ?? "") > 1)
            .map((rule) => rule.selector)

        expect(containerClasses.size).toBeGreaterThan(4)
        expect(offenders).toEqual([])
    })
})
