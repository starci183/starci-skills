import { DEADLINE_SCHEDULER, DeadlineSchedulerService } from "@modules/platform/http"
import type { DeadlineScheduler } from "@modules/platform/http"
import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { DatabaseReadinessService } from "./database-readiness.service"
import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"
import { PRIMARY_ENTITY_MANAGER } from "./primary.decorators"

/** Asymmetric matchers read as `unknown`: jest types them `any`, which may not flow into a property or a typed argument. */
const anyOf = (type: unknown): unknown => expect.any(type)

const build = async () => {
    const manager = mockEntityManager()
    const deadlines = mock<DeadlineScheduler>()
    deadlines.schedule.mockImplementation(new DeadlineSchedulerService().schedule)
    const moduleRef = await Test.createTestingModule({
        providers: [
            DatabaseReadinessService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: DEADLINE_SCHEDULER, useValue: deadlines },
        ],
    }).compile()
    return { service: moduleRef.get(DatabaseReadinessService), manager, deadlines }
}

describe("DatabaseReadinessService", () => {
    it("answers ready only after the required primary database returns", async () => {
        const { service, manager } = await build()
        manager.query.mockResolvedValue([{ "?column?": 1 }])

        await expect(service.check()).resolves.toEqual({ status: "ok", dependencies: { primary: "ok" } })
        expect(manager.query).toHaveBeenCalledWith("select 1")
    })

    it("answers unavailable when the primary database fails without exposing the driver error", async () => {
        const { service, manager } = await build()
        manager.query.mockRejectedValue(new Error("driver connection failed"))

        await expect(service.check()).rejects.toMatchObject({
            code: DatabaseErrorCode.RequiredUnavailable,
            params: { dependency: "primary" },
        })
    })

    it("answers unavailable when scheduling fails before a cancellation callback is returned", async () => {
        const { service, manager, deadlines } = await build()
        const cause = new DatabaseError({ code: DatabaseErrorCode.RequiredUnavailable })
        deadlines.schedule.mockImplementation(() => {
            throw cause
        })
        manager.query.mockImplementation(() => new Promise(() => {}))

        await expect(service.check()).rejects.toMatchObject({
            code: DatabaseErrorCode.RequiredUnavailable,
            params: { dependency: "primary" },
            cause,
        })
        expect(deadlines.schedule).toHaveBeenCalledWith(anyOf(Function), 1000)
    })

    it("cancels the deadline when starting the primary query throws synchronously", async () => {
        jest.useFakeTimers()
        try {
            const { service, manager } = await build()
            const cause = new DatabaseError({ code: DatabaseErrorCode.RequiredUnavailable })
            manager.query.mockImplementation(() => {
                throw cause
            })

            await expect(service.check()).rejects.toMatchObject({
                code: DatabaseErrorCode.RequiredUnavailable,
                params: { dependency: "primary" },
                cause,
            })
            expect(jest.getTimerCount()).toBe(0)
        } finally {
            jest.useRealTimers()
        }
    })

    it("answers unavailable within one second when the database never responds", async () => {
        jest.useFakeTimers()
        try {
            const { service, manager } = await build()
            manager.query.mockImplementation(() => new Promise(() => {}))
            const check = expect(service.check()).rejects.toMatchObject({
                code: DatabaseErrorCode.RequiredUnavailable,
                params: { dependency: "primary" },
                cause: anyOf(DatabaseError),
            })

            await jest.advanceTimersByTimeAsync(1000)

            await check
            expect(jest.getTimerCount()).toBe(0)
        } finally {
            jest.useRealTimers()
        }
    })
})
