// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FAMILY_ROOTS, familyOf } from "../../../__test__/grammarRoots.js"
import { Button } from "../../primitive/Button/index.js"
import { ButtonGroup } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("ButtonGroup under %s", (family, Root) => {
    it("names a group of Grammar buttons that each keep their own tab stop", () => {
        const { container } = render(<Root>
            <ButtonGroup label="Formatting">
                <Button>Bold</Button>
                <Button>Italic</Button>
            </ButtonGroup>
        </Root>)
        expect(familyOf(container)).toBe(family)
        const group = screen.getByRole("group", { name: "Formatting" })
        const buttons = within(group).getAllByRole("button")
        expect(buttons.map((button) => button.getAttribute("data-component"))).toEqual(["Button", "Button"])
        expect(buttons.every((button) => button.tabIndex === 0)).toBe(true)
        expect(group.getAttribute("data-component")).toBe("ButtonGroup")
        expect(group.getAttribute("data-grammar-orientation")).toBe("horizontal")
    })
})

describe("ButtonGroup states", () => {
    it("disables every button and carries orientation and width", () => {
        render(<ButtonGroup label="Paging" isDisabled orientation="vertical" width="fill">
            <Button>Previous</Button>
            <Button>Next</Button>
        </ButtonGroup>)
        const group = screen.getByRole("group", { name: "Paging" })
        expect(within(group).getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(true)
        expect(group.getAttribute("data-grammar-orientation")).toBe("vertical")
        expect(group.getAttribute("data-width")).toBe("fill")
        expect(group.getAttribute("data-grammar-disabled")).toBe("true")
    })
})
