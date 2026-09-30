import { describe, expect, it } from "vitest"
import { COMMON_MESSAGES, withCommonMessages } from "./catalog"

describe("withCommonMessages", () => {
    it("lays the app's own copy over the shared common copy per locale", async () => {
        const loaders = withCommonMessages({
            en: async () => ({ default: { app: { title: "Shop" } } }),
            vi: async () => ({ default: { app: { title: "Shop (second locale)" } } }),
        })
        const en = (await loaders.en()).default
        expect(en.app).toEqual({ title: "Shop" })
        expect(en.errors).toEqual(COMMON_MESSAGES.en.errors)
        const vi = (await loaders.vi()).default
        expect(vi.notFound).toEqual(COMMON_MESSAGES.vi.notFound)
    })

    it("ships the same common namespaces in every locale", () => {
        expect(Object.keys(COMMON_MESSAGES.vi).sort()).toEqual(Object.keys(COMMON_MESSAGES.en).sort())
    })
})
