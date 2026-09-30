import { INVITATION_EXPIRY_DAYS, isShareRole, isWellFormedEmail, liveStatusOf, normalizeEmail } from "./invitation.policy"

const DAY = 24 * 60 * 60 * 1000
const SENT = new Date("2026-09-01T10:00:00.000Z")

describe("invitation policy", () => {
    it("normalizes an address by trimming and lower-casing", () => {
        expect(normalizeEmail("  Ann@Example.COM ")).toBe("ann@example.com")
    })

    it("accepts the shape of an email and refuses the rest", () => {
        expect(isWellFormedEmail("ann@example.com")).toBe(true)
        expect(isWellFormedEmail("ann@example")).toBe(false)
        expect(isWellFormedEmail("ann example@x.co")).toBe(false)
    })

    it("knows exactly two roles", () => {
        expect(isShareRole("viewer")).toBe(true)
        expect(isShareRole("editor")).toBe(true)
        expect(isShareRole("owner")).toBe(false)
    })

    it("reads a pending row as expired only past the window and every other status as stored", () => {
        const inside = new Date(SENT.getTime() + INVITATION_EXPIRY_DAYS * DAY)
        const past = new Date(SENT.getTime() + INVITATION_EXPIRY_DAYS * DAY + 1)
        expect(liveStatusOf({ status: "pending", sentAt: SENT }, inside)).toBe("pending")
        expect(liveStatusOf({ status: "pending", sentAt: SENT }, past)).toBe("expired")
        expect(liveStatusOf({ status: "accepted", sentAt: SENT }, past)).toBe("accepted")
        expect(liveStatusOf({ status: "revoked", sentAt: SENT }, past)).toBe("revoked")
    })
})
