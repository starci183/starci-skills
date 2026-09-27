// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { Input } from "./primitive/Input/index.js"
import { Checkbox } from "./primitive/Checkbox/index.js"
import { CheckboxGroup } from "./composite/CheckboxGroup/index.js"
import { RadioGroup } from "./composite/RadioGroup/index.js"
import { Textarea } from "./primitive/Textarea/index.js"
import { Select } from "./branch/Select/index.js"
import { SearchField } from "./primitive/SearchField/index.js"
import { NumberField } from "./primitive/NumberField/index.js"
import { DateField } from "./primitive/DateField/index.js"
import { TimeField } from "./primitive/TimeField/index.js"
import { DatePicker } from "./branch/DatePicker/index.js"
import { DateRangePicker } from "./branch/DateRangePicker/index.js"
import { ComboBox } from "./branch/ComboBox/index.js"

afterEach(cleanup)

type Variant = "primary" | "secondary"
const options = [{ value: "a", label: "A" }, { value: "b", label: "B" }]
const list = [{ id: "a", label: "A" }, { id: "b", label: "B" }]

/**
 * ANATOMY-2 case-1 (owner, 2026-09-28): a form control placed ON a surface takes HeroUI's nested
 * `secondary` variant - every control whose vendor anatomy has one, not only Input. Each renders the
 * `data-grammar-variant` hook a draw gate reads and the vendor's `--secondary` paint class.
 */
const CONTROLS: ReadonlyArray<readonly [string, (variant?: Variant) => ReactElement, string]> = [
    ["Input", (variant) => <Input id="i" name="i" label="Name" {...(variant ? { variant } : {})} />, "input--"],
    ["Checkbox", (variant) => <Checkbox label="Remember me" {...(variant ? { variant } : {})} />, "checkbox--"],
    ["CheckboxGroup", (variant) => <CheckboxGroup label="Topics" options={options} {...(variant ? { variant } : {})} />, "checkbox-group--"],
    ["RadioGroup", (variant) => <RadioGroup label="Plan" options={options} {...(variant ? { variant } : {})} />, "radio-group--"],
    ["Textarea", (variant) => <Textarea label="Bio" {...(variant ? { variant } : {})} />, "textarea--"],
    ["Select", (variant) => <Select label="Country" options={list} {...(variant ? { variant } : {})} />, "select--"],
    ["SearchField", (variant) => <SearchField label="Search" {...(variant ? { variant } : {})} />, "search-field--"],
    ["NumberField", (variant) => <NumberField label="Seats" {...(variant ? { variant } : {})} />, "number-field--"],
    ["DateField", (variant) => <DateField label="Due" {...(variant ? { variant } : {})} />, "date-input-group--"],
    ["TimeField", (variant) => <TimeField label="At" {...(variant ? { variant } : {})} />, "date-input-group--"],
    ["DatePicker", (variant) => <DatePicker label="Due" {...(variant ? { variant } : {})} />, "date-input-group--"],
    ["DateRangePicker", (variant) => <DateRangePicker label="Window" {...(variant ? { variant } : {})} />, "date-input-group--"],
    ["ComboBox", (variant) => <ComboBox label="City" options={list} {...(variant ? { variant } : {})} />, "input--"],
]

const classesIn = (root: Element) => [root, ...root.querySelectorAll("*")].flatMap((el) => [...el.classList])

describe.each(CONTROLS)("%s layer variant", (name, draw, prefix) => {
    it("defaults to primary (the page background)", () => {
        const { container } = render(draw())
        const root = container.querySelector(`[data-component='${name}']`)
        expect(root?.getAttribute("data-grammar-variant")).toBe("primary")
        expect(classesIn(root!).some((c) => c === `${prefix}primary`)).toBe(true)
        expect(classesIn(root!).some((c) => c === `${prefix}secondary`)).toBe(false)
    })

    it("passes secondary through to HeroUI when nested on a surface", () => {
        const { container } = render(draw("secondary"))
        const root = container.querySelector(`[data-component='${name}']`)
        expect(root?.getAttribute("data-grammar-variant")).toBe("secondary")
        expect(classesIn(root!).some((c) => c === `${prefix}secondary`)).toBe(true)
        expect(classesIn(root!).some((c) => c === `${prefix}primary`)).toBe(false)
    })
})
