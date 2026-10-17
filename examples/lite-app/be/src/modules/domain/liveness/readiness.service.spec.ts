import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { LivenessError, LivenessErrorCode } from "./errors/liveness.error"
import { CHECK_READINESS_DATABASE, CHECK_READINESS_JOBS } from "./persistence/readiness.sql"
import { LivenessLogEvent } from "./readiness.log-events"
import { ReadinessService } from "./readiness.service"

const build = async (manager: MockEntityManager = mockEntityManager()) => {
    const logger = mock<Logger>()
    const timer = mock<Timer>()
    const cancel = jest.fn()
    timer.schedule.mockReturnValue(cancel)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReadinessService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: LOGGER, useValue: logger },
            { provide: TIMER, useValue: timer },
        ],
    }).compile()
    return { readiness: moduleRef.get(ReadinessService), manager, logger, timer, cancel }
}

describe("ReadinessService", () => {
    it("answers ready with every named check once each probe returns", async () => {
        const { readiness, manager, timer, cancel } = await build(
            mockEntityManager({
                query: [
                    [CHECK_READINESS_DATABASE, [{ ready: 1 }]],
                    [CHECK_READINESS_JOBS, [{ stats: { queued: 0 } }]],
                ],
            }),
        )

        await expect(readiness.check()).resolves.toEqual({
            status: "ready",
            checks: { database: "ok", jobs: "ok" },
        })

        expect(manager.query).toHaveBeenCalledWith(CHECK_READINESS_DATABASE)
        expect(manager.query).toHaveBeenCalledWith(CHECK_READINESS_JOBS)
        expect(timer.schedule).toHaveBeenCalledTimes(2)
        expect(timer.schedule).toHaveBeenCalledWith(expect.any(Function), 3000)
        expect(cancel).toHaveBeenCalledTimes(2)
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

    it("fails closed when a probe throws before returning a promise", async () => {
        const manager = mockEntityManager()
        const failure = new LivenessError({ code: LivenessErrorCode.Unavailable })
        manager.query.mockImplementation(() => {
            throw failure
        })
        const { readiness, logger, timer, cancel } = await build(manager)

        await expect(readiness.check()).rejects.toMatchObject({ code: LivenessErrorCode.Unavailable })
        expect(logger.error).toHaveBeenCalledWith(LivenessLogEvent.CheckFailed, failure, { check: "database" })
        expect(logger.error).toHaveBeenCalledWith(LivenessLogEvent.CheckFailed, failure, { check: "jobs" })
        expect(timer.schedule).not.toHaveBeenCalled()
        expect(cancel).not.toHaveBeenCalled()
    })
})

describe("ReadinessService probe responses", () => {
    it.each([
        [[], [{ stats: {} }]],
        [[{ ready: 0 }], [{ stats: {} }]],
        [[{ stats: {} }], [{ stats: {} }]],
        [[{ ready: 1 }], [{ ready: 1 }]],
        [[{ ready: 1 }], [{ stats: "invalid" }]],
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
        const { readiness, logger, timer, cancel } = await build(manager)
        const failed = expect(readiness.check()).rejects.toMatchObject({ code: LivenessErrorCode.Unavailable })

        expect(timer.schedule).toHaveBeenCalledTimes(2)
        for (const [callback] of timer.schedule.mock.calls) callback()
        await failed

        expect(logger.error).toHaveBeenCalledWith(LivenessLogEvent.CheckFailed, expect.any(Error), {
            check: "database",
        })
        expect(logger.error).toHaveBeenCalledWith(LivenessLogEvent.CheckFailed, expect.any(Error), { check: "jobs" })
        expect(timer.schedule).toHaveBeenCalledTimes(2)
        expect(timer.schedule).toHaveBeenCalledWith(expect.any(Function), 3000)
        expect(cancel).toHaveBeenCalledTimes(2)
    })
})
