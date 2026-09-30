import { AcceptLanguageLocale } from "./request-locale.service"

describe("AcceptLanguageLocale", () => {
    const locale = new AcceptLanguageLocale()

    it("picks the first supported language of the header", () => {
        expect(locale.of("fr-FR, en-US;q=0.8, vi;q=0.5")).toBe("en")
        expect(locale.of("vi-VN")).toBe("vi")
    })

    it("falls back to Vietnamese when nothing supported is named", () => {
        expect(locale.of("fr, de")).toBe("vi")
        expect(locale.of(undefined)).toBe("vi")
    })
})
