import { Test } from "@nestjs/testing"
import { FakeClock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LivenessService } from "./liveness.service"

const START = "2026-01-01T00:00:00.000Z"

const build = async () => {
    const clock = new FakeClock(START)
    const moduleRef = await Test.createTestingModule({
        providers: [LivenessService, { provide: CLOCK, useValue: clock }],
    }).compile()
    return { service: moduleRef.get(LivenessService), clock }
}

describe("LivenessService", () => {
    describe("check", () => {
        it("answers ok with the start instant and no uptime right after the start", async () => {
            const { service } = await build()

            await expect(service.check()).resolves.toEqual({ status: "ok", startedAt: START, uptimeSeconds: 0 })
        })

        it("counts whole seconds of uptime from the clock and keeps the start instant", async () => {
            const { service, clock } = await build()

            clock.advance(90_999)

            await expect(service.check()).resolves.toEqual({ status: "ok", startedAt: START, uptimeSeconds: 90 })
        })

        it("rounds a partial second down and stays at zero under one second", async () => {
            const { service, clock } = await build()

            clock.advance(999)

            await expect(service.check()).resolves.toMatchObject({ uptimeSeconds: 0 })
        })
    })
})
