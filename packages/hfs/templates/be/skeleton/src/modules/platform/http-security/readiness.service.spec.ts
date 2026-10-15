import { ServiceUnavailableException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ReadinessService } from "./readiness.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ReadinessService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ReadinessService)
}

describe("ReadinessService", () => {
    afterEach(() => jest.useRealTimers())

    it("opens and commits a transaction against the required database before reporting ready", async () => {
        const transaction = fakeTransaction(mockEntityManager())
        const service = await build(transaction.em)
        await expect(service.probeRequired()).resolves.toEqual({ ok: true })
        expect(transaction.em.transaction).toHaveBeenCalledTimes(1)
        expect(transaction.commits).toBe(1)
    })

    it("reports 503 when the required database rejects the probe", async () => {
        const entityManager = mockEntityManager()
        entityManager.transaction.mockRejectedValue(new Error("connection unavailable"))
        const service = await build(entityManager)
        await expect(service.probeRequired()).rejects.toBeInstanceOf(ServiceUnavailableException)
    })

    it("reports 503 within the bounded timeout when the required database never answers", async () => {
        jest.useFakeTimers()
        const entityManager = mockEntityManager()
        entityManager.transaction.mockReturnValue(new Promise(() => undefined))
        const service = await build(entityManager)
        const expected = expect(service.probeRequired()).rejects.toBeInstanceOf(ServiceUnavailableException)
        await jest.advanceTimersByTimeAsync(1000)
        await expected
        expect(jest.getTimerCount()).toBe(0)
    })

    it("clears the timeout when the database answers early", async () => {
        jest.useFakeTimers()
        const entityManager = mockEntityManager()
        entityManager.transaction.mockResolvedValue(undefined)
        const service = await build(entityManager)
        await expect(service.probeRequired()).resolves.toEqual({ ok: true })
        expect(jest.getTimerCount()).toBe(0)
        await jest.advanceTimersByTimeAsync(1000)
        expect(jest.getTimerCount()).toBe(0)
    })
})
