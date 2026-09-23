// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/grammarRoots.js"
import { Button } from "../../primitive/Button/index.js"
import { Checkbox } from "../../primitive/Checkbox/index.js"
import { Textarea } from "../../primitive/Textarea/index.js"
import { RadioGroup } from "../RadioGroup/index.js"
import { Fieldset } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("Fieldset under %s", (family, Root) => {
    it("is a native fieldset named by its legend, with guidance, a group error and actions", () => {
        const { container } = render(<Root>
            <Fieldset legend="Shipping" description="Where it goes" errorMessage="Dates overlap" actions={<Button>Save</Button>}>
                <Textarea label="Address" />
            </Fieldset>
        </Root>)
        expect(familyOf(container)).toBe(family)
        const group = screen.getByRole("group", { name: "Shipping" })
        expect(group.tagName).toBe("FIELDSET")
        expect(describedTexts(group)).toEqual(["Where it goes", "Dates overlap"])
        expect(within(group).getByRole("textbox", { name: "Address" })).toBeTruthy()
        expect(within(group).getByRole("button", { name: "Save" })).toBeTruthy()
        expect(group.getAttribute("data-grammar-invalid")).toBe("true")
    })
})

describe("Fieldset states", () => {
    it("disables every control inside, including div-rendered groups", () => {
        render(<Fieldset legend="Locked" isDisabled isLegendHidden>
            <Checkbox label="Agree" />
            <RadioGroup label="Plan" options={[{ value: "a", label: "A" }]} />
            <Button>Go</Button>
        </Fieldset>)
        const group = screen.getByRole("group", { name: "Locked" }) as HTMLFieldSetElement
        expect(group.disabled).toBe(true)
        expect(screen.getByRole("radiogroup", { name: "Plan" }).getAttribute("aria-disabled")).toBe("true")
        // A native button inside a disabled fieldset is disabled by the platform itself.
        expect(screen.getByRole("button", { name: "Go" }).matches(":disabled")).toBe(true)
        expect((screen.getByRole("checkbox", { name: "Agree" }) as HTMLInputElement).matches(":disabled")).toBe(true)
        expect(group.querySelector("legend")?.className).toContain("starci-core-form-label--screen-reader")
    })
})
