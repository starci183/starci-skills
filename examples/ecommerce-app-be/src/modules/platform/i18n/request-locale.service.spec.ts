import { Test } from "@nestjs/testing"
import { AcceptLanguageRequestLocale } from "./request-locale.service"

describe("AcceptLanguageRequestLocale", () => {
    const build = async (): Promise<AcceptLanguageRequestLocale> => {
        const moduleRef = await Test.createTestingModule({ providers: [AcceptLanguageRequestLocale] }).compile()
        return moduleRef.get(AcceptLanguageRequestLocale)
    }

    it("picks Vietnamese when the header lists Vietnamese", async () => {
        expect((await build()).of("vi-VN,vi;q=0.9")).toBe("vi")
    })

    it("picks English when the header lists English, whatever the letter case", async () => {
        expect((await build()).of("EN-us")).toBe("en")
    })

    it("picks the first supported language and skips unsupported ones", async () => {
        expect((await build()).of("fr-FR, de;q=0.8, en;q=0.5, vi;q=0.4")).toBe("en")
    })

    it("joins a repeated header before choosing", async () => {
        expect((await build()).of(["fr", "en"])).toBe("en")
    })

    it("falls back to Vietnamese when no listed language is supported", async () => {
        expect((await build()).of("fr-FR,de")).toBe("vi")
    })

    it("falls back to Vietnamese when the header is absent", async () => {
        expect((await build()).of(undefined)).toBe("vi")
    })
})
