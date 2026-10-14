import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { DatabaseReadinessService } from "./database-readiness.service"
import { DatabaseErrorCode } from "./errors/database.error"
import { PRIMARY_ENTITY_MANAGER } from "./primary.decorators"

const build = async () => {
    const manager = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [DatabaseReadinessService, { provide: PRIMARY_ENTITY_MANAGER, useValue: manager }],
    }).compile()
    return { service: moduleRef.get(DatabaseReadinessService), manager }
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

    it("answers unavailable within one second when the database never responds", async () => {
        jest.useFakeTimers()
        try {
            const { service, manager } = await build()
            manager.query.mockImplementation(() => new Promise(() => {}))
            const check = expect(service.check()).rejects.toMatchObject({ code: DatabaseErrorCode.RequiredUnavailable })

            await jest.advanceTimersByTimeAsync(1000)

            await check
            expect(jest.getTimerCount()).toBe(0)
        } finally {
            jest.useRealTimers()
        }
    })
})
