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

