import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Input } from "./index.js"

describe("Core Input", () => {
    it("owns error, disabled, required, and surface state", () => {
        const markup = renderToStaticMarkup(
            <Input
                id="password"
                name="password"
                label="Password"
                kind="newPassword"
                variant="primary"
                errorMessage="Use at least 8 characters."
                isError
                isDisabled
                isRequired
            />,
        )

        expect(markup).toContain("data-component=\"Input\"")
        expect(markup).toContain("aria-invalid=\"true\"")
        expect(markup).toContain("disabled=\"\"")
        expect(markup).toContain("Use at least 8 characters.")
    })
})


describe("Core Input tel kind", () => {
    it("opens the phone keypad and offers the saved phone number", () => {
        const markup = renderToStaticMarkup(<Input id="phone" name="phone" label="Phone" kind="tel" />)

        expect(markup).toContain("type=\"tel\"")
        expect(markup).toContain("inputMode=\"tel\"")
        expect(markup).toContain("autoComplete=\"tel\"")
    })

    it("keeps the text kind free of phone semantics", () => {
        const markup = renderToStaticMarkup(<Input id="name" name="name" label="Name" />)

        expect(markup).toContain("type=\"text\"")
        expect(markup).not.toContain("inputMode=\"tel\"")
    })
})
