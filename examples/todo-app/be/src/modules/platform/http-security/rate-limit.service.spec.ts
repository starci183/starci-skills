import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RATE_LIMIT_STORE } from "./http-security.decorators"
import { HttpSecurityLogEvent } from "./http-security.log-events"
import { RateLimitService } from "./rate-limit.service"
import type { RateLimitStore } from "./rate-limit-store.port"

const WINDOW_MS = 60_000
const hitOf = (key: string) => ({ key, windowMs: WINDOW_MS })

const build = async () => {
    const clock = new FakeClock("2026-05-01T10:00:00.000Z")
    const store = mock<RateLimitStore>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            RateLimitService,
            { provide: RATE_LIMIT_STORE, useValue: store },
            { provide: CLOCK, useValue: clock },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(RateLimitService), clock, store, logger }
}

describe("RateLimitService", () => {
    describe("count", () => {
        it("counts in the shared store and answers its count", async () => {
            const { service, store, logger } = await build()
            store.hit.mockResolvedValue(7)

            await expect(service.count(hitOf("default:10.0.0.1"))).resolves.toBe(7)

            expect(store.hit).toHaveBeenCalledWith(hitOf("default:10.0.0.1"))
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("degrades to an in-process window per key while the store fails, logging once per window", async () => {
            const { service, store, logger } = await build()
            const failure = new Error("connection refused")
            store.hit.mockRejectedValue(failure)

            await expect(service.count(hitOf("strict:10.0.0.1"))).resolves.toBe(1)
            await expect(service.count(hitOf("strict:10.0.0.1"))).resolves.toBe(2)
            await expect(service.count(hitOf("strict:10.0.0.2"))).resolves.toBe(1)

            expect(logger.error).toHaveBeenCalledTimes(1)
            expect(logger.error).toHaveBeenCalledWith(HttpSecurityLogEvent.RateLimitStoreDegraded, failure, {
                windowMs: WINDOW_MS,
            })
        })

        it("starts a new local window, and logs again, once the window has passed", async () => {
            const { service, clock, store, logger } = await build()
            store.hit.mockRejectedValue(new Error("connection refused"))
            await service.count(hitOf("default:10.0.0.1"))
            await service.count(hitOf("default:10.0.0.1"))

            clock.advance(WINDOW_MS)

            await expect(service.count(hitOf("default:10.0.0.1"))).resolves.toBe(1)
            expect(logger.error).toHaveBeenCalledTimes(2)
        })

        it("counts in the store again as soon as it answers", async () => {
            const { service, store } = await build()
            store.hit.mockRejectedValueOnce(new Error("connection refused")).mockResolvedValueOnce(3)

            await expect(service.count(hitOf("default:10.0.0.1"))).resolves.toBe(1)
            await expect(service.count(hitOf("default:10.0.0.1"))).resolves.toBe(3)
        })

        it("drops the lapsed local windows once more than ten thousand keys are counted", async () => {
            const { service, clock, store } = await build()
            store.hit.mockRejectedValue(new Error("connection refused"))
            await service.count(hitOf("default:lapsed"))
            clock.advance(WINDOW_MS)

            for (let caller = 0; caller < 10_000; caller += 1) await service.count(hitOf(`default:${caller}`))

            await expect(service.count(hitOf("default:lapsed"))).resolves.toBe(1)
            await expect(service.count(hitOf("default:0"))).resolves.toBe(2)
        })
    })
})
