import { ServiceUnavailableException } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { mock } from "@starci/jest-preset"
import { ReadinessService } from "./readiness.service"

describe("ReadinessService", () => {
    afterEach(() => jest.useRealTimers())

    it("opens and commits a transaction against the required database before reporting ready", async () => {
        const entityManager = mock<EntityManager>()
        entityManager.transaction.mockImplementation(async (work) => work(entityManager))
        const service = new ReadinessService(entityManager)
        await expect(service.probeRequired()).resolves.toEqual({ ok: true })
        expect(entityManager.transaction).toHaveBeenCalledTimes(1)
    })

    it("reports 503 when the required database rejects the probe", async () => {
        const entityManager = mock<EntityManager>()
        entityManager.transaction.mockRejectedValue(new Error("connection unavailable"))
        await expect(new ReadinessService(entityManager).probeRequired()).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        )
    })

    it("reports 503 within the bounded timeout when the required database never answers", async () => {
        jest.useFakeTimers()
        const entityManager = mock<EntityManager>()
        entityManager.transaction.mockReturnValue(new Promise(() => undefined))
        const expected = expect(new ReadinessService(entityManager).probeRequired()).rejects.toBeInstanceOf(
            ServiceUnavailableException,
        )
        await jest.advanceTimersByTimeAsync(1000)
        await expected
        expect(jest.getTimerCount()).toBe(0)
    })

    it("clears the timeout when the database answers early", async () => {
        jest.useFakeTimers()
        const entityManager = mock<EntityManager>()
        entityManager.transaction.mockResolvedValue(undefined)
        await expect(new ReadinessService(entityManager).probeRequired()).resolves.toEqual({ ok: true })
        expect(jest.getTimerCount()).toBe(0)
        await jest.advanceTimersByTimeAsync(1000)
        expect(jest.getTimerCount()).toBe(0)
    })
})
