import { isRecord } from "./record.policy"

describe("isRecord", () => {
    it("accepts objects and arrays", () => {
        expect(isRecord({ a: 1 })).toBe(true)
        expect(isRecord([])).toBe(true)
    })

    it("rejects null and primitives", () => {
        expect(isRecord(null)).toBe(false)
        expect(isRecord("text")).toBe(false)
        expect(isRecord(3)).toBe(false)
        expect(isRecord(undefined)).toBe(false)
    })
})
