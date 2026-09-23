// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/overlayRoots.js"
import { Spinner } from "./index.js"

afterEach(cleanup)

const css = readFileSync(resolve(process.cwd(), "src/common/components-overlays.css"), "utf8")

describe.each(GRAMMAR_ROOT_CASES)("Common Spinner under $name", ({ Root, family }) => {
    it("announces what is loading as a named status", () => {
        render(<Root><Spinner label="Saving draft" size="lg" /></Root>)
        const spinner = screen.getByRole("status", { name: "Saving draft" })

        expect(spinner.getAttribute("data-component")).toBe("Spinner")
        expect(spinner.getAttribute("data-size")).toBe("lg")
        expect(spinner.getAttribute("data-tone")).toBe("accent")
        expect(spinner.querySelector("svg")).toBeTruthy()
        expectInFamilyScope(spinner, family)
    })

    it("can inherit the surrounding colour", () => {
        render(<Root><Spinner label="Loading" tone="current" /></Root>)
        expect(screen.getByRole("status", { name: "Loading" }).getAttribute("data-tone")).toBe("current")
    })
})

describe("Common Spinner reduced motion", () => {
    it("replaces rotation with a slow pulse under prefers-reduced-motion", () => {
        const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"))
        expect(reduced).toContain(".starci-core-spinner > svg")
        expect(reduced).toContain("animation: starci-core-pulse")
    })
})
