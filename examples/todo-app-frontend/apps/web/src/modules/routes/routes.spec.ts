import { describe, expect, it } from "vitest"
import { ROUTES } from "./index"

describe("ROUTES", () => {
    it("names every destination as a locale-free absolute path", () => {
        for (const path of Object.values(ROUTES)) expect(path).toMatch(/^\/[a-z-]+(\/[a-z-]+)*$/)
    })
})
