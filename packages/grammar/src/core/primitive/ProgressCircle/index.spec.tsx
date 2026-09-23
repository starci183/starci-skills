// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { ProgressCircle } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common ProgressCircle under $name", ({ Root, family }) => {
    it("exposes a named determinate progressbar", () => {
        render(<Root><ProgressCircle label="Upload" value={42} size="sm" /></Root>)
        const ring = screen.getByRole("progressbar", { name: "Upload" })

        expect(ring.getAttribute("data-component")).toBe("ProgressCircle")
        expect(ring.getAttribute("data-indeterminate")).toBe("false")
        expect(ring.getAttribute("aria-valuenow")).toBe("42")
        expect(ring.getAttribute("aria-valuemin")).toBe("0")
        expect(ring.getAttribute("aria-valuemax")).toBe("100")
        expect(ring.querySelector("[data-slot=\"progress-circle-fill-circle\"]")).toBeTruthy()
        expectInFamilyScope(ring, family)
    })

    it("announces indeterminate work without a value", () => {
        render(<Root><ProgressCircle label="Syncing" isIndeterminate /></Root>)
        const ring = screen.getByRole("progressbar", { name: "Syncing" })
        expect(ring.getAttribute("data-indeterminate")).toBe("true")
        expect(ring.hasAttribute("aria-valuenow")).toBe(false)
    })
})
