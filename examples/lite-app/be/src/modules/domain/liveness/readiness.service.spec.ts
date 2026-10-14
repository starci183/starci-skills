import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LivenessErrorCode } from "./errors/liveness.error"
import { CHECK_READINESS_DATABASE, CHECK_READINESS_JOBS } from "./persistence/readiness.sql"
import { LivenessLogEvent } from "./readiness.log-events"
import { ReadinessService } from "./readiness.service"

const build = async (manager: MockEntityManager = mockEntityManager()) => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReadinessService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { readiness: moduleRef.get(ReadinessService), manager, logger }
}

describe("ReadinessService", () => {
    afterEach(() => jest.useRealTimers())

    it("answers ready with every named check once each probe returns", async () => {
        const { readiness, manager } = await build(
            mockEntityManager({
                query: [
                    [CHECK_READINESS_DATABASE, [{ ready: 1 }]],
                    [CHECK_READINESS_JOBS, [{ stats: { queued: 0 } }]],
                ],
            }),
        )
        jest.useFakeTimers()

        await expect(readiness.check()).resolves.toEqual({
            status: "ready",
            checks: { database: "ok", jobs: "ok" },
        })

        expect(manager.query).toHaveBeenCalledWith(CHECK_READINESS_DATABASE)
        expect(manager.query).toHaveBeenCalledWith(CHECK_READINESS_JOBS)
        expect(jest.getTimerCount()).toBe(0)
    })

    it("fails the check closed when a dependency probe throws", async () => {
        // The jobs probe is deliberately not stubbed: the double throws where the spec declares no answer.
        const { readiness, logger } = await build(
            mockEntityManager({
                query: [[CHECK_READINESS_DATABASE, [{ ready: 1 }]]],
            }),
        )

        await expect(readiness.check()).rejects.toMatchObject({ code: LivenessErrorCode.Unavailable })
        expect(logger.error).toHaveBeenCalledWith(LivenessLogEvent.CheckFailed, expect.any(Error), { check: "jobs" })
    })

    it.each([
        [[], [{ stats: {} }]],
        [[{ ready: 0 }], [{ stats: {} }]],
        [[{ ready: 1 }], []],
        [[{ ready: 1 }], [{ stats: null }]],
    ])("fails closed when the required probe answer is absent or invalid", async (database, jobs) => {
        const { readiness } = await build(
            mockEntityManager({
                query: [
                    [CHECK_READINESS_DATABASE, database],
                    [CHECK_READINESS_JOBS, jobs],
                ],
            }),
        )

        await expect(readiness.check()).rejects.toMatchObject({ code: LivenessErrorCode.Unavailable })
    })

    it("bounds a stalled dependency and clears its timer after failing closed", async () => {
        const manager = mockEntityManager()
        manager.query.mockImplementation(() => new Promise(() => undefined))
        const { readiness, logger } = await build(manager)
        jest.useFakeTimers()
        const failed = expect(readiness.check()).rejects.toMatchObject({ code: LivenessErrorCode.Unavailable })

        await jest.advanceTimersByTimeAsync(3000)
        await failed

        expect(logger.error).toHaveBeenCalledWith(LivenessLogEvent.CheckFailed, expect.any(Error), { check: "database" })
        expect(logger.error).toHaveBeenCalledWith(LivenessLogEvent.CheckFailed, expect.any(Error), { check: "jobs" })
        expect(jest.getTimerCount()).toBe(0)
    })
})
