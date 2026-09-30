import { describe, expect, it } from "vitest"
import { moduleHref } from "./index"

describe("routes", () => {
    it("builds the module href", () => {
        expect(moduleHref("w1", "accounting")).toBe("/w1/accounting")
    })
})
