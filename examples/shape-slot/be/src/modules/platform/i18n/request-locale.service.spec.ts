import { Test } from "@nestjs/testing"
import { AcceptLanguageRequestLocale } from "./request-locale.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [AcceptLanguageRequestLocale] }).compile()
    return moduleRef.get(AcceptLanguageRequestLocale)
}

describe("AcceptLanguageRequestLocale", () => {
    describe("of", () => {
        it.each([
            ["en-US,en;q=0.9,vi;q=0.8", "en"],
            ["vi-VN,vi;q=0.9", "vi"],
            ["EN", "en"],
        ])("picks the first supported language of %s", async (header, expected) => {
            const locale = await build()

            expect(locale.of(header)).toBe(expected)
        })

        it("skips unsupported languages until a supported one", async () => {
            const locale = await build()

            expect(locale.of("fr-FR, de;q=0.8, en;q=0.5")).toBe("en")
        })

        it("joins a header sent as several lines", async () => {
            const locale = await build()

            expect(locale.of(["fr", "en-GB"])).toBe("en")
        })

        it("defaults to Vietnamese when nothing supported is listed", async () => {
            const locale = await build()

            expect(locale.of("fr, de")).toBe("vi")
        })

        it("defaults to Vietnamese when the header is absent", async () => {
            const locale = await build()

            expect(locale.of(undefined)).toBe("vi")
        })
    })
})
