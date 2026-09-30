import { localDateInZone, resolveRuleInstant } from "./zone.policy"

const instantOf = (zone: string, date: string, time: string): string => resolveRuleInstant(zone, date, time).instant.toISOString()

describe("zone policy", () => {
    it("shifts a spring-forward gap forward by its size: Berlin 02:30 on 2026-03-29 is 01:30Z", () => {
        const resolution = resolveRuleInstant("Europe/Berlin", "2026-03-29", "02:30")
        expect(resolution.kind).toBe("gap")
        expect(resolution.instant.toISOString()).toBe("2026-03-29T01:30:00.000Z")
    })

    it("takes the earlier real instant of a fall-back fold: New York 01:30 on 2024-11-03 is 05:30Z, and it is stable", () => {
        const resolution = resolveRuleInstant("America/New_York", "2024-11-03", "01:30")
        expect(resolution.kind).toBe("fold")
        expect(resolution.instant.toISOString()).toBe("2024-11-03T05:30:00.000Z")
        expect(instantOf("America/New_York", "2024-11-03", "01:30")).toBe("2024-11-03T05:30:00.000Z")
    })

    it("keeps a fixed-offset zone at the same offset all year", () => {
        expect(instantOf("Asia/Ho_Chi_Minh", "2026-01-15", "09:00")).toBe("2026-01-15T02:00:00.000Z")
        expect(instantOf("Asia/Ho_Chi_Minh", "2026-07-15", "09:00")).toBe("2026-07-15T02:00:00.000Z")
    })

    it("follows the offset of a DST zone: Berlin 09:00 is 08:00Z in winter and 07:00Z in summer", () => {
        expect(instantOf("Europe/Berlin", "2026-01-15", "09:00")).toBe("2026-01-15T08:00:00.000Z")
        expect(instantOf("Europe/Berlin", "2026-07-15", "09:00")).toBe("2026-07-15T07:00:00.000Z")
    })

    it("resolves the same nominal time to different instants in different zones", () => {
        expect(instantOf("Asia/Ho_Chi_Minh", "2026-01-15", "09:00")).not.toBe(instantOf("Europe/Berlin", "2026-01-15", "09:00"))
    })

    it("resolves a time before and after a transition on the day of the transition normally", () => {
        const before = resolveRuleInstant("Europe/Berlin", "2026-03-29", "01:00")
        expect(before.kind).toBe("normal")
        expect(before.instant.toISOString()).toBe("2026-03-29T00:00:00.000Z")
        const after = resolveRuleInstant("Europe/Berlin", "2026-03-29", "10:00")
        expect(after.kind).toBe("normal")
        expect(after.instant.toISOString()).toBe("2026-03-29T08:00:00.000Z")
    })

    it("reads today from the zone of the rule, not from the host clock", () => {
        const instant = new Date("2026-03-29T23:30:00.000Z")
        expect(localDateInZone("Asia/Ho_Chi_Minh", instant)).toBe("2026-03-30")
        expect(localDateInZone("Europe/Berlin", instant)).toBe("2026-03-30")
        expect(localDateInZone("America/New_York", instant)).toBe("2026-03-29")
    })
})
