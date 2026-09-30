import { hashPassword, verifyPassword } from "./password.policy"

describe("password policy", () => {
    it("verifies the password a hash was made from", () => {
        expect(verifyPassword("correct horse", hashPassword("correct horse"))).toBe(true)
    })

    it("refuses another password and a hash of another length", () => {
        expect(verifyPassword("wrong", hashPassword("correct horse"))).toBe(false)
        expect(verifyPassword("correct horse", "short")).toBe(false)
    })

    it("hashes deterministically to 128 hex characters", () => {
        expect(hashPassword("a")).toBe(hashPassword("a"))
        expect(hashPassword("a")).toMatch(/^[0-9a-f]{128}$/)
    })
})
