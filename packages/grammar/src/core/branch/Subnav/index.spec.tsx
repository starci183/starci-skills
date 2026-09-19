// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Subnav } from "./index.js"
import { subnavToggleClassName } from "./classNames.js"

/** jsdom rewrites `import.meta.url` to an http URL, so the sheet is resolved from the package root. */
const stylesPath = ["src/common/styles.css", "packages/grammar/src/common/styles.css"]
    .map((candidate) => resolve(process.cwd(), candidate))
    .find((candidate) => existsSync(candidate)) ?? ""
const css = readFileSync(stylesPath, "utf8")

afterEach(cleanup)

describe("Core Subnav", () => {
    it("renders compact identity and toggles the consumer-owned drawer", () => {
        const onMenuOpenChange = vi.fn()
        const { container } = render(
            <Subnav
                label="Course navigation"
                title="Fullstack Mastery"
                leading={<span>Logo</span>}
                menuIcon={<span>Menu</span>}
                openMenuLabel="Open course navigation"
                closeMenuLabel="Close course navigation"
                isMenuOpen={false}
                onMenuOpenChange={onMenuOpenChange}
            />,
        )

        expect(container.querySelector("[data-grammar-subnav='true']")?.getAttribute("data-grammar-subnav-visibility")).toBe("compact")
        expect(container.querySelector("[data-grammar-subnav='true']")?.className).not.toContain("top-16")
        expect(screen.getByText("Fullstack Mastery")).toBeTruthy()
        const trigger = screen.getByRole("button", { name: "Open course navigation" })
        expect(trigger.className).toContain("button--tertiary")
        fireEvent.click(trigger)
        expect(onMenuOpenChange).toHaveBeenCalledWith(true)
    })

    /*
     * THE TOGGLE IS ALREADY 2.75rem, AND NOW IT WINS.
     *
     * There is no size prop and there should not be one: 2.75rem is the minimum target this control
     * has to meet, not a choice a caller makes. What was missing is that the shipped declaration
     * lost to the vendor's own button sizing, which is declared in a later layer - so a consumer was
     * re-forcing `size-11` from outside the package to get the target back. The rule is important
     * for the same reason the four beside it are, and this asserts the rendered element carries the
     * class the rule selects.
     */
    it("ships the 44px toggle target on the rendered control and takes no size prop", () => {
        render(
            <Subnav
                label="Course navigation"
                title="Fullstack Mastery"
                menuIcon={<span>Menu</span>}
                openMenuLabel="Open course navigation"
                closeMenuLabel="Close course navigation"
                isMenuOpen={false}
            />,
        )
        const trigger = screen.getByRole("button", { name: "Open course navigation" })
        expect(trigger.getAttribute("data-grammar-subnav-toggle")).toBe("true")
        expect([...trigger.classList]).toContain("starci-core-subnav-toggle")
        expect(subnavToggleClassName).toContain("starci-core-subnav-toggle")
        expect(subnavToggleClassName).not.toMatch(/size-|h-\d|w-\d/)
        expect(css).toMatch(/\.starci-core-subnav-toggle\s*\{[\s\S]*?width: 2\.75rem !important;[\s\S]*?height: 2\.75rem !important;/)
    })
})
