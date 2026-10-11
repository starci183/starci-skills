// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { COMMON_GRAMMAR_COMPONENTS } from "../common/index.js"

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
const rules = (source: string) => [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!.trim(), body: m[2]! }))
const sheets = {
    styles: read("../common/styles.css"),
    forms: read("../common/components-forms.css"),
    navigation: read("../common/components-navigation.css"),
    overlays: read("../common/components-overlays.css"),
}
const offsetPopForms = read("../offset-pop/components-forms.css")
const offsetPopOverlays = read("../offset-pop/components-overlays.css")
const packageJson = JSON.parse(read("../../package.json")) as { version: string }
const changelog = read("../../CHANGELOG.md")

const only = (hook: string, home: keyof typeof sheets) => {
    expect(sheets[home], `${hook} lives in ${home}`).toContain(hook)
    for (const [name, source] of Object.entries(sheets)) if (name !== home) expect(source, `${hook} must not be in ${name}`).not.toContain(hook)
}

describe("0.9.7: loading views for the remaining components (knowledge STATE-8)", () => {
    it("is at 0.9.7 with a changelog entry and adds no catalog component", () => {
        expect(packageJson.version).toBe("0.9.7")
        expect(changelog).toContain("## 0.9.7 - 2026-10-11")
        expect(Object.keys(COMMON_GRAMMAR_COMPONENTS)).toHaveLength(104)
    })

    it("keeps each component's skeleton rules in its own group sheet", () => {
        only(".starci-core-section-skeleton-action", "styles")
        only(".starci-core-chat-bubble-skeleton-body", "styles")
        only(".starci-core-field-skeleton-control", "forms")
        only(".starci-core-breadcrumb-skeleton", "navigation")
        only(".starci-core-list-box-skeleton-option", "navigation")
        only(".starci-core-meter-skeleton-bar", "overlays")
        only(".starci-core-avatar-skeleton", "navigation")
        only(".starci-core-step-skeleton-marker", "navigation")
        only(".starci-core-timeline-skeleton-marker", "navigation")
    })

    it("sizes the skeleton fields like the loaded controls", () => {
        const body = (selector: string) => rules(sheets.forms).filter((r) => r.selector.includes(selector)).map((r) => r.body).join("\n")
        expect(body('[data-grammar-field-skeleton="select"]')).toContain("block-size: 2.5rem")
        expect(body('[data-grammar-field-skeleton="textarea"]')).toMatch(/block-size: max\(5rem, calc\(var\(--starci-core-skeleton-rows, 4\) \* 1\.25rem \+ 1rem\)\)/)
        expect(sheets.forms).toMatch(/@media \(pointer: coarse\), \(max-width: 40rem\) \{\s*\.starci-core-field-skeleton-control:is\(\[data-grammar-field-skeleton="select"\][^{]*\{\s*min-block-size: var\(--starci-core-control-min-size/)
    })

    it("uses tokens only in the new rules (no hard-coded colour)", () => {
        for (const hook of ["skeleton-action", "chat-bubble-skeleton", "field-skeleton", "breadcrumb-skeleton", "list-box-skeleton", "meter-skeleton", "avatar-skeleton", "step-skeleton", "timeline-skeleton"]) {
            for (const source of Object.values(sheets)) {
                for (const rule of rules(source).filter((r) => r.selector.includes(hook))) expect(rule.body, rule.selector).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
            }
        }
    })

    it("gives Offset Pop the field outline around a loading Select or Textarea and the ink track around the loading Meter", () => {
        expect(offsetPopForms).toMatch(/\[data-component="Select"\], \[data-component="Textarea"\], \[data-component="NumberField"\], \[data-component="SearchField"\], \[data-component="SegmentedControl"\]\) \.starci-core-field-skeleton-control \{[^}]*border: var\(--offset-pop-outline-width\) solid var\(--offset-pop-ink\)/)
        expect(offsetPopOverlays).toMatch(/\[data-component="Meter"\] \[data-slot="meter-track"\] \{[^}]*border: var\(--offset-pop-outline-width\) solid var\(--border\)/)
        expect(read("./primitive/Meter/index.tsx")).toContain('data-slot="meter-track" className="starci-core-meter-skeleton-bar"')
    })

    it("sizes the new skeleton fields like the loaded controls", () => {
        expect(sheets.forms).toMatch(/data-grammar-field-skeleton="input"\]\) \{ block-size: 2\.5rem; \}/)
        expect(sheets.forms).toMatch(/\[data-grammar-field-skeleton="segmented"\] \{\s*block-size: 2\.5rem;\s*inline-size: min\(100%, calc\(var\(--starci-core-skeleton-segments, 2\) \* 5rem\)\);/)
        expect(sheets.forms).toMatch(/\[data-grammar-field-skeleton="switch"\] \{ flex: none; block-size: 1\.25rem; inline-size: 2rem; \}/)
        expect(offsetPopForms).toMatch(/\[data-component="CheckboxGroup"\], \[data-component="Switch"\]\) \.starci-core-field-skeleton-control \{[^}]*border: var\(--offset-pop-outline-width\) solid var\(--offset-pop-ink\)/)
    })

    it("takes reduced motion from the Skeleton atom, never an animation of its own", () => {
        expect(sheets.overlays).toMatch(/prefers-reduced-motion: reduce\) \{[^]*\.starci-core-skeleton,/)
        for (const source of Object.values(sheets)) {
            for (const rule of rules(source).filter((r) => /(section|chat-bubble|field|breadcrumb|list-box|meter|avatar|step|timeline)-skeleton/.test(r.selector))) expect(rule.body, rule.selector).not.toMatch(/animation/)
        }
    })
})
