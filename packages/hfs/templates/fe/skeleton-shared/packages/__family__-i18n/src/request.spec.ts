import { defineRouting } from "next-intl/routing"
import { describe, expect, it } from "vitest"
import { resolveLocale } from "./request"

const routing = defineRouting({ locales: ["vi", "en"], defaultLocale: "vi", localePrefix: "as-needed" })

describe("resolveLocale", () => {
    it("keeps a served locale", () => {
        expect(resolveLocale(routing, "en")).toBe("en")
    })

    it("falls back to the default for an unknown or missing locale", () => {
        expect(resolveLocale(routing, "fr")).toBe("vi")
        expect(resolveLocale(routing, undefined)).toBe("vi")
    })
})
