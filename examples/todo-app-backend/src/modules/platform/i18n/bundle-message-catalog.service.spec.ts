import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { BundleMessageCatalog } from "./bundle-message-catalog.service"
import type { I18nOptions } from "./i18n.options"
import { I18N_OPTIONS } from "./i18n.decorators"

const defaults: I18nOptions = {
    bundles: [
        {
            vi: { "task.title": "Cong viec {{title}}", "task.count": "{{n}} viec" },
            en: { "task.title": "Task {{title}}", "task.count": "{{n}} tasks" },
        },
        { vi: { "share.ok": "Da chia se" }, en: { "share.ok": "Shared" } },
    ],
}

const build = async (overrides?: Partial<I18nOptions>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BundleMessageCatalog, { provide: I18N_OPTIONS, useValue: builder<I18nOptions>(defaults)(overrides) }],
    }).compile()
    return moduleRef.get(BundleMessageCatalog)
}

describe("BundleMessageCatalog", () => {
    describe("get", () => {
        it("fills the placeholders of the text in the locale", async () => {
            const catalog = await build()

            expect(catalog.get("task.title", { title: "Write" }, "en")).toBe("Task Write")
            expect(catalog.get("task.title", { title: "Write" }, "vi")).toBe("Cong viec Write")
        })

        it("fills a numeric parameter", async () => {
            const catalog = await build()

            expect(catalog.get("task.count", { n: 3 }, "en")).toBe("3 tasks")
        })

        it("reads a key from any composed bundle", async () => {
            const catalog = await build()

            expect(catalog.get("share.ok", {}, "en")).toBe("Shared")
        })

        it("leaves a placeholder without a value as written", async () => {
            const catalog = await build()

            expect(catalog.get("task.title", {}, "en")).toBe("Task {{title}}")
        })

        it("answers the key itself for an unknown key", async () => {
            const catalog = await build()

            expect(catalog.get("no.such.key", {}, "en")).toBe("no.such.key")
        })

        it("answers the key itself when no bundle is composed", async () => {
            const catalog = await build({ bundles: [] })

            expect(catalog.get("task.title", {}, "vi")).toBe("task.title")
        })
    })
})
