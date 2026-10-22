import { builder } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { BundleMessageCatalog } from "./bundle-message-catalog.service"
import { I18N_OPTIONS } from "./i18n.decorators"
import type { I18nOptions } from "./i18n.options"

const BUNDLES: I18nOptions["bundles"] = [
    { vi: { "greet.hello": "Xin chao {{name}}" }, en: { "greet.hello": "Hello {{name}}" } },
    { vi: { "cart.count": "{{count}} san pham" }, en: { "cart.count": "{{count}} items" } },
]

describe("BundleMessageCatalog", () => {
    const build = async (overrides?: Partial<I18nOptions>): Promise<BundleMessageCatalog> => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                BundleMessageCatalog,
                { provide: I18N_OPTIONS, useValue: builder<I18nOptions>({ bundles: BUNDLES })(overrides) },
            ],
        }).compile()
        return moduleRef.get(BundleMessageCatalog)
    }

    it("returns the text of a key in each language with placeholders filled", async () => {
        const catalog = await build()

        expect(catalog.get("greet.hello", { name: "An" }, "vi")).toBe("Xin chao An")
        expect(catalog.get("greet.hello", { name: "An" }, "en")).toBe("Hello An")
    })

    it("reads keys owned by any of the merged bundles", async () => {
        expect((await build()).get("cart.count", { count: 3 }, "en")).toBe("3 items")
    })

    it("keeps a placeholder as written when no value is given for it", async () => {
        expect((await build()).get("greet.hello", {}, "en")).toBe("Hello {{name}}")
    })

    it("returns the key itself when no bundle owns it", async () => {
        expect((await build()).get("missing.key", {}, "vi")).toBe("missing.key")
    })

    it("returns the key when the app composed no bundle", async () => {
        expect((await build({ bundles: [] })).get("greet.hello", {}, "en")).toBe("greet.hello")
    })
})
