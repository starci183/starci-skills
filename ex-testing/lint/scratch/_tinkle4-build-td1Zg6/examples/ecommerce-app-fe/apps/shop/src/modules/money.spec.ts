import { describe, expect, it } from "vitest"
import { formatPrice } from "./money"

describe("formatPrice", () => {
    it("reads the amount in minor units, never shows them", () => {
        expect(formatPrice(8900, "USD")).toBe("$89.00")
        expect(formatPrice(0, "USD")).toBe("$0.00")
        expect(formatPrice(123456, "USD")).toBe("$1,234.56")
    })

    it("writes each listed currency the way its own locale writes it", () => {
        expect(formatPrice(6200, "EUR")).toMatch(/62,00/)
        expect(formatPrice(8900, "VND")).toContain("89")
        expect(formatPrice(8900, "VND")).not.toContain("8900")
    })

    it("keeps a code the table does not list readable instead of dropping the amount", () => {
        expect(formatPrice(1500, "GBP")).toContain("15.00")
    })

    it("falls back to a tagged number when the code is no currency at all", () => {
        expect(formatPrice(1200, "EURO")).toBe("12.00 EURO")
    })
})
