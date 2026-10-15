import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { DatabaseProbeService } from "./database-probe.service"
import { PRIMARY_ENTITY_MANAGER } from "./primary.decorators"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [DatabaseProbeService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(DatabaseProbeService)
}

describe("DatabaseProbeService", () => {
    it("opens and commits a transaction against the required database", async () => {
        const transaction = fakeTransaction(mockEntityManager())
        const service = await build(transaction.em)

        await expect(service.probe()).resolves.toBeUndefined()

        expect(transaction.em.transaction).toHaveBeenCalledTimes(1)
        expect(transaction.commits).toBe(1)
    })

    it("propagates a failed database transaction", async () => {
        const entityManager = mockEntityManager()
        entityManager.transaction.mockRejectedValue(new Error("connection unavailable"))
        const service = await build(entityManager)

        await expect(service.probe()).rejects.toThrow("connection unavailable")
    })
})
