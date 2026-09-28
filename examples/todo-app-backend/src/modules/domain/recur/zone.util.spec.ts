import {
    resolveRuleInstant, localDateInZone 
} from "./zone.util"

describe("zone.util (sds.recur.generation-engine, br.recur.timezone.owner-local-time)",
    () => {
        it("ac.recur.timezone.owner-local-time.dst-spring-forward-shifts-by-gap: Europe/Berlin 02:30 on 2026-03-29 resolves to 2026-03-29T01:30:00.000Z, not the transition instant and not any instant formatting to the nonexistent 02:30 local",
            () => {
                const resolution = resolveRuleInstant("Europe/Berlin",
                    "2026-03-29",
                    "02:30")
                expect(resolution.kind).toBe("gap")
                expect(resolution.instant.toISOString()).toBe("2026-03-29T01:30:00.000Z")
                expect(resolution.instant.toISOString()).not.toBe("2026-03-29T00:30:00.000Z")
            })

        it("ac.recur.timezone.owner-local-time.dst-fall-back-picks-earliest: America/New_York 01:30 on 2024-11-03 resolves to the earlier real instant, 2024-11-03T05:30:00.000Z, not the later 06:30:00.000Z",
            () => {
                const resolution = resolveRuleInstant("America/New_York",
                    "2024-11-03",
                    "01:30")
                expect(resolution.kind).toBe("fold")
                expect(resolution.instant.toISOString()).toBe("2024-11-03T05:30:00.000Z")
                expect(resolution.instant.toISOString()).not.toBe("2024-11-03T06:30:00.000Z")
            })

        it("exactly one instant is produced for the fold window - no second, later candidate is silently generated",
            () => {
                const first = resolveRuleInstant("America/New_York",
                    "2024-11-03",
                    "01:30")
                const second = resolveRuleInstant("America/New_York",
                    "2024-11-03",
                    "01:30")
                expect(first.instant.toISOString()).toBe(second.instant.toISOString())
            })

        it("ac.recur.timezone.owner-local-time.distinct-zones-differ: Asia/Ho_Chi_Minh 09:00 keeps the same +07:00 offset across a DST-observing date change",
            () => {
                const january = resolveRuleInstant("Asia/Ho_Chi_Minh",
                    "2026-01-15",
                    "09:00")
                const july = resolveRuleInstant("Asia/Ho_Chi_Minh",
                    "2026-07-15",
                    "09:00")
                expect(january.instant.toISOString()).toBe("2026-01-15T02:00:00.000Z")
                expect(july.instant.toISOString()).toBe("2026-07-15T02:00:00.000Z")
            })

        it("ac.recur.timezone.owner-local-time.distinct-zones-differ: Europe/Berlin 09:00 shifts offset between CET and CEST",
            () => {
                const january = resolveRuleInstant("Europe/Berlin",
                    "2026-01-15",
                    "09:00")
                const july = resolveRuleInstant("Europe/Berlin",
                    "2026-07-15",
                    "09:00")
                expect(january.instant.toISOString()).toBe("2026-01-15T08:00:00.000Z")
                expect(july.instant.toISOString()).toBe("2026-07-15T07:00:00.000Z")
            })

        it("ac.recur.timezone.owner-local-time.distinct-zones-differ: the same nominal 09:00 differs between Ho_Chi_Minh and Berlin on both dates",
            () => {
                const hcmJan = resolveRuleInstant("Asia/Ho_Chi_Minh",
                    "2026-01-15",
                    "09:00").instant.toISOString()
                const berlinJan = resolveRuleInstant("Europe/Berlin",
                    "2026-01-15",
                    "09:00").instant.toISOString()
                const hcmJul = resolveRuleInstant("Asia/Ho_Chi_Minh",
                    "2026-07-15",
                    "09:00").instant.toISOString()
                const berlinJul = resolveRuleInstant("Europe/Berlin",
                    "2026-07-15",
                    "09:00").instant.toISOString()
                expect(hcmJan).not.toBe(berlinJan)
                expect(hcmJul).not.toBe(berlinJul)
            })

        it("a nominal time safely before a gap-day transition resolves normally, using the pre-transition offset",
            () => {
                const resolution = resolveRuleInstant("Europe/Berlin",
                    "2026-03-29",
                    "01:00")
                expect(resolution.kind).toBe("normal")
                expect(resolution.instant.toISOString()).toBe("2026-03-29T00:00:00.000Z")
            })

        it("a nominal time safely after a gap-day transition resolves normally, using the post-transition offset",
            () => {
                const resolution = resolveRuleInstant("Europe/Berlin",
                    "2026-03-29",
                    "10:00")
                expect(resolution.kind).toBe("normal")
                expect(resolution.instant.toISOString()).toBe("2026-03-29T08:00:00.000Z")
            })

        it("localDateInZone reads \"today\" from the rule's own zone, not the host clock",
            () => {
                // 2026-03-29T23:30:00Z is still 2026-03-30 in Asia/Ho_Chi_Minh (+07:00) but still 2026-03-30 01:30 CEST
                // in Europe/Berlin after the spring-forward - both ahead of the UTC calendar date.
                expect(localDateInZone("Asia/Ho_Chi_Minh",
                    new Date("2026-03-29T23:30:00.000Z"))).toBe("2026-03-30")
                expect(localDateInZone("Europe/Berlin",
                    new Date("2026-03-29T23:30:00.000Z"))).toBe("2026-03-30")
                expect(localDateInZone("America/New_York",
                    new Date("2026-03-29T23:30:00.000Z"))).toBe("2026-03-29")
            })
    })
