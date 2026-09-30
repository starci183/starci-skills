import { describe, expect, it } from "vitest"
import { createAppI18n } from "./app"

describe("createAppI18n", () => {
    it("serves the default locale without a prefix", () => {
        const i18n = createAppI18n({ locales: ["vi", "en"], defaultLocale: "vi" })
        expect(i18n.DEFAULT_LOCALE).toBe("vi")
        expect(i18n.LOCALES).toEqual(["vi", "en"])
        expect(i18n.routing.localePrefix).toBe("as-needed")
    })

    it("builds the navigation helpers on the same routing table", () => {
        const i18n = createAppI18n({ locales: ["vi"], defaultLocale: "vi" })
        expect(i18n.getPathname({ href: "/", locale: "vi" })).toBe("/")
    })
})
