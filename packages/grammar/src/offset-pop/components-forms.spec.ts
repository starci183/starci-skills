import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { COMMON_GRAMMAR_COMPONENTS } from "../common/index.js"
import { COMMON_FORMS_COMPONENTS } from "../common/renderers-forms.js"
import { coreGrammar } from "../core/index.js"
import { offsetPopGrammar } from "./index.js"

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8")
const familyCss = read("src/offset-pop/components-forms.css")
const commonCss = read("src/common/components-forms.css")
const commonEntry = read("src/common/styles.css")

const FORM_COMPONENTS = [
    "ButtonGroup", "Checkbox", "CheckboxGroup", "ComboBox", "DateField", "DatePicker", "DateRangePicker", "Field",
    "Fieldset", "FileDropzone", "Form", "NumberField", "RadioGroup", "SearchField", "SegmentedControl", "Select",
    "Slider", "Switch", "Textarea", "TimeField",
] as const

const sourceFiles = (directory: string): ReadonlyArray<string> => readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(path) && !/\.(spec|test)\./.test(path) ? [path] : []
})
const rendererSource = sourceFiles(resolve(process.cwd(), "src/core")).map((path) => readFileSync(path, "utf8")).join("\n")
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "")

describe("Form components registry", () => {
    it("registers every form component in Common and therefore in every family", () => {
        expect(Object.keys(COMMON_FORMS_COMPONENTS).sort()).toEqual([...FORM_COMPONENTS].sort())
        expect(Object.isFrozen(COMMON_FORMS_COMPONENTS)).toBe(true)
        for (const name of FORM_COMPONENTS) {
            expect(COMMON_GRAMMAR_COMPONENTS[name]).toBe(COMMON_FORMS_COMPONENTS[name])
            expect(coreGrammar.components[name]).toBe(COMMON_FORMS_COMPONENTS[name])
            expect(offsetPopGrammar.components[name]).toBe(COMMON_FORMS_COMPONENTS[name])
            expect(rendererSource, `${name} must stamp its data-component hook`).toContain(`data-component="${name}"`)
        }
    })
})

describe("Common form anatomy CSS", () => {
    it("is imported by the Common entry and stays inside the Common layer", () => {
        // Every component sheet is imported right after the layer-order statement, before any rule.
        const entryHead = commonEntry.slice(0, commonEntry.indexOf("@layer starci-grammar-common {")).replace(/\/\*[\s\S]*?\*\//g, "").trim()
        expect(entryHead).toMatch(/^@layer [^;{]+;(?:\s*@import "[^"]+";)+$/)
        expect(entryHead).toContain("@import \"./components-forms.css\";")
        const css = withoutComments(commonCss)
        expect(css.trim().startsWith("@layer starci-grammar-common {")).toBe(true)
        expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i)
        expect(css).not.toContain("--offset-pop-")
    })

    it("draws the anatomy of every form renderer and the 44px touch floor", () => {
        for (const className of [
            "starci-core-field", "starci-core-field-label", "starci-core-field-description", "starci-core-field-error",
            "starci-core-textarea-control", "starci-core-select-trigger", "starci-core-combo-box-group",
            "starci-core-search-field-group", "starci-core-number-field-group", "starci-core-date-group",
            "starci-core-choice-content", "starci-core-choice-group-options", "starci-core-slider-header",
            "starci-core-segment", "starci-core-button-group", "starci-core-fieldset", "starci-core-form",
            "starci-core-file-dropzone-target", "starci-core-file-dropzone-input",
        ]) {
            expect(commonCss, className).toContain(`.${className}`)
            expect(rendererSource, `${className} must be emitted by a renderer`).toContain(className)
        }
        expect(commonCss).toContain("@media (pointer: coarse), (max-width: 40rem)")
        expect(commonCss).toContain("min-block-size: var(--starci-core-control-min-size, 2.75rem)")
        expect(commonCss).toContain("min-inline-size: var(--starci-core-control-min-size, 2.75rem)")
        expect(commonCss).toContain("@media (prefers-reduced-motion: reduce)")
    })
})

describe("Offset Pop form treatment CSS", () => {
    it("lives in the family layer and scopes every selector to the family root", () => {
        const css = withoutComments(familyCss)
        expect(css.trim().startsWith("@layer starci-grammar-offset-pop {")).toBe(true)
        expect(css).not.toContain("@import")
        const selectorLines = css
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith(".") && (line.endsWith("{") || line.endsWith(",")))
        expect(selectorLines.length).toBeGreaterThan(40)
        for (const selector of selectorLines) {
            expect(selector.startsWith(".grammar-common-root[data-grammar-family=\"offset-pop\"]"), selector).toBe(true)
        }
    })

    it("targets each form component hook", () => {
        for (const name of FORM_COMPONENTS) {
            expect(familyCss, `missing family treatment for ${name}`).toContain(`[data-component="${name}"]`)
        }
    })

    it("targets only hooks the renderers emit", () => {
        const hooks = new Set(Array.from(familyCss.matchAll(/\[(data-grammar-[a-z-]+)(?:[=\]])/g), (match) => match[1]!))
        expect(hooks.size).toBeGreaterThan(10)
        for (const hook of hooks) {
            if (hook === "data-grammar-family") continue
            expect(rendererSource, `missing renderer hook: ${hook}`).toContain(hook)
        }
    })

    it("applies the family signature: ink outline, hard offset shadow, pink selection", () => {
        expect(familyCss).toContain("border: var(--offset-pop-outline-width) solid var(--offset-pop-ink)")
        expect(familyCss).toContain("box-shadow: var(--offset-pop-shadow-x) var(--offset-pop-shadow-x) 0 var(--offset-pop-shadow-ink)")
        expect(familyCss).toMatch(/:focus-visible[\s\S]*?box-shadow: var\(--offset-pop-shadow-x\) var\(--offset-pop-shadow-x\) 0 var\(--offset-pop-field-ring/)
        expect(familyCss).toMatch(/\[data-pressed="true"\][\s\S]*?transform: translate\(var\(--offset-pop-shadow-x\), var\(--offset-pop-shadow-x\)\)/)
        expect(familyCss).toMatch(/\[data-selected="true"\][\s\S]*?background: var\(--offset-pop-pink\)/)
        expect(familyCss).toMatch(/\[data-grammar-slider-fill\][\s\S]*?background: var\(--offset-pop-pink\)/)
        expect(familyCss).toContain("--offset-pop-field-ring: var(--offset-pop-critical)")
        expect(familyCss).not.toContain("--starci-core-")
        expect(familyCss).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    })

    it("removes motion and paints forced colors", () => {
        const reduced = familyCss.slice(familyCss.indexOf("@media (prefers-reduced-motion: reduce)"))
        expect(reduced).toContain("transform: none")
        expect(reduced).toContain("translate: none")
        expect(reduced).toContain("transition: none")
        const forced = familyCss.slice(familyCss.indexOf("@media (forced-colors: active)"))
        expect(forced).toContain("border-color: CanvasText")
        expect(forced).toContain("background: Highlight")
    })

    it("contains no domain vocabulary", () => {
        for (const css of [familyCss, commonCss]) {
            for (const word of ["price", "checkout", "enrollment", "student", "exam", "course", "entitlement", "mia"]) {
                expect(css.toLowerCase()).not.toMatch(new RegExp(`\\b${word}\\b`))
            }
        }
    })
})
