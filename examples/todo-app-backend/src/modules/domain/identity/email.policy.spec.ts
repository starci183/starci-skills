import { isPlausibleEmail } from "./email.policy"

describe("isPlausibleEmail", () => {
    it("accepts a normal address", () => {
        expect(isPlausibleEmail("a@b.co")).toBe(true)
    })

    it("refuses text without an at sign, a domain dot or with spaces", () => {
        expect(isPlausibleEmail("ab.co")).toBe(false)
        expect(isPlausibleEmail("a@b")).toBe(false)
        expect(isPlausibleEmail("a b@c.co")).toBe(false)
    })
})
