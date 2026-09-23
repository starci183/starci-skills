// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, describedTexts, familyOf } from "../../../__test__/familyRoots.js"
import { Button } from "../../primitive/Button/index.js"
import { Textarea } from "../../primitive/Textarea/index.js"
import { SearchField } from "../../primitive/SearchField/index.js"
import { Form } from "./index.js"

afterEach(cleanup)

describe.each(FAMILY_ROOTS)("Form under %s", (family, Root) => {
    it("is a named form landmark that hands the values to onSubmit", async () => {
        const onSubmit = vi.fn()
        const { container } = render(<Root>
            <Form label="Feedback" onSubmit={onSubmit}>
                <Textarea label="Message" name="message" defaultValue="Hi" />
                <Button type="submit">Send</Button>
            </Form>
        </Root>)
        expect(familyOf(container)).toBe(family)
        const form = screen.getByRole("form", { name: "Feedback" })
        await act(async () => {
            fireEvent.submit(form)
        })
        expect(onSubmit).toHaveBeenCalledTimes(1)
        const data = onSubmit.mock.calls[0]?.[0] as FormData
        expect(data.get("message")).toBe("Hi")
    })

    it("shows server validation errors in the matching control's own error slot", () => {
        render(<Root>
            <Form label="Profile" validationErrors={{ nick: "Already taken" }}>
                <SearchField label="Nick" name="nick" />
            </Form>
        </Root>)
        const input = screen.getByRole("searchbox", { name: "Nick" })
        expect(input.getAttribute("aria-invalid")).toBe("true")
        expect(describedTexts(input)).toContain("Already taken")
    })
})

describe("Form states", () => {
    it("announces pending and ignores a second submit", async () => {
        const onSubmit = vi.fn()
        const { container } = render(<Form label="Busy" onSubmit={onSubmit} isPending><Button type="submit">Send</Button></Form>)
        const form = screen.getByRole("form", { name: "Busy" })
        expect(form.getAttribute("aria-busy")).toBe("true")
        expect(container.querySelector("[data-component='Form']")?.getAttribute("data-grammar-field-state")).toBe("pending")
        await act(async () => {
            fireEvent.submit(form)
        })
        expect(onSubmit).not.toHaveBeenCalled()
    })

    it("resets and keeps native validation by default", () => {
        const onReset = vi.fn()
        render(<Form label="Plain" onReset={onReset}><Textarea label="Note" isRequired /></Form>)
        const form = screen.getByRole("form", { name: "Plain" }) as HTMLFormElement
        expect(form.noValidate).toBe(false)
        expect((screen.getByRole("textbox", { name: /Note/ }) as HTMLTextAreaElement).required).toBe(true)
        fireEvent.reset(form)
        expect(onReset).toHaveBeenCalled()
    })
})
