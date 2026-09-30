import { BundleMessageCatalogService } from "./bundle-message-catalog.service"

const catalog = new BundleMessageCatalogService({
    bundles: [
        { vi: { "a.b": "xin chao {{name}}" }, en: { "a.b": "hello {{name}}" } },
        { vi: { "c.d": "tam biet" }, en: { "c.d": "bye" } },
    ],
})

describe("BundleMessageCatalogService", () => {
    it("fills placeholders in the requested locale", () => {
        expect(catalog.get("a.b", { name: "An" }, "en")).toBe("hello An")
        expect(catalog.get("a.b", { name: "An" }, "vi")).toBe("xin chao An")
    })

    it("merges the bundles of several owners", () => {
        expect(catalog.get("c.d", {}, "en")).toBe("bye")
    })

    it("answers the key of an unknown message and keeps a placeholder without a value", () => {
        expect(catalog.get("missing", {}, "en")).toBe("missing")
        expect(catalog.get("a.b", {}, "en")).toBe("hello {{name}}")
    })
})
