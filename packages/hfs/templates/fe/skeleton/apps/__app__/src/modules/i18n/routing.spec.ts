import { describe, expect, it } from "vitest"
import { routing } from "./routing"

describe("routing", () => {
    it("serves vi by default, without a prefix", () => {
        expect(routing.defaultLocale).toBe("vi")
        expect(routing.localePrefix).toBe("as-needed")
        expect(routing.locales).toContain("vi")
    })
})
