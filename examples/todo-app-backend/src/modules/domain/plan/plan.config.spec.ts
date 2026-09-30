import { EnvSource } from "@modules/platform/config"
import { parsePlanConfig } from "./plan.config"

describe("parsePlanConfig", () => {
    it("falls back to the catalog price and currency when nothing is declared", () => {
        expect(parsePlanConfig(new EnvSource({}))).toEqual({ paidPriceMinorUnits: 99000, paidCurrency: "VND" })
    })

    it("reads the tunables when they are declared", () => {
        const env = new EnvSource({ PLAN_PAID_PRICE_MINOR_UNITS: "150000", PLAN_PAID_CURRENCY: "USD" })
        expect(parsePlanConfig(env)).toEqual({ paidPriceMinorUnits: 150000, paidCurrency: "USD" })
    })
})
