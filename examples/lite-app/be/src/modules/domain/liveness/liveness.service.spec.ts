import { FakeClock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CLOCK } from "@modules/platform/clock"
import { LivenessService } from "./liveness.service"

const build = async (clock: FakeClock) => {
    const moduleRef = await Test.createTestingModule({
        providers: [LivenessService, { provide: CLOCK, useValue: clock }],
    }).compile()
    return moduleRef.get(LivenessService)
}

describe("LivenessService", () => {
    describe("check", () => {
        it("answers ok with the start instant and no uptime right after the process started", async () => {
            const liveness = await build(new FakeClock("2026-10-01T00:00:00.000Z"))

            await expect(liveness.check()).resolves.toEqual({
                status: "ok",
                startedAt: "2026-10-01T00:00:00.000Z",
                uptimeSeconds: 0,
            })
        })

        it("counts the whole seconds elapsed on the clock since the process started", async () => {
            const clock = new FakeClock("2026-10-01T00:00:00.000Z")
            const liveness = await build(clock)
            clock.advance(90_999)

            await expect(liveness.check()).resolves.toEqual({
                status: "ok",
                startedAt: "2026-10-01T00:00:00.000Z",
                uptimeSeconds: 90,
            })
        })
    })
})
