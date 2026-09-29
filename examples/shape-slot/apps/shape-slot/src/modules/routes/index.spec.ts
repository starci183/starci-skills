import { describe, expect, it } from "vitest"
import { moduleHref, operateHref } from "./index"

describe("routes", () => {
    it("builds the module href", () => {
        expect(moduleHref("w1", "accounting")).toBe("/w1/accounting")
    })

    it("builds the operate href", () => {
        expect(operateHref("w1", "h9")).toBe("/w1/operate/h9")
    })
})
