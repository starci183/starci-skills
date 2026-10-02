import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { @@connectionUpper@@_ENTITY_MANAGER } from "@modules/platform/database"
import { @@Name@@Projection } from "./@@name@@.projection"
import { @@Name@@ProjectionEntity } from "./@@name@@.projection-entity"

const build = async (manager: MockEntityManager = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [@@Name@@Projection, { provide: @@connectionUpper@@_ENTITY_MANAGER, useValue: manager }],
    }).compile()
    return { projection: moduleRef.get(@@Name@@Projection), manager }
}

describe("@@Name@@Projection", () => {
    describe("recompute@@Name@@", () => {
        it("idempotently upserts the row by its natural id", async () => {
            const { projection, manager } = await build(
                mockEntityManager({
                    upsert: [@@Name@@ProjectionEntity, { identifiers: [], generatedMaps: [], raw: [] }],
                }),
            )

            await projection.recompute@@Name@@("projection-1")
            await projection.recompute@@Name@@("projection-1")

            expect(manager.upsert).toHaveBeenNthCalledWith(1, @@Name@@ProjectionEntity, { id: "projection-1" }, [
                "id",
            ])
            expect(manager.upsert).toHaveBeenNthCalledWith(2, @@Name@@ProjectionEntity, { id: "projection-1" }, [
                "id",
            ])
        })
    })

    describe("get@@Name@@", () => {
        it("maps a stored row to its public view", async () => {
            const { projection, manager } = await build()
            manager.findOne.mockResolvedValue(Object.assign(new @@Name@@ProjectionEntity(), { id: "projection-1" }))

            await expect(projection.get@@Name@@("projection-1")).resolves.toEqual({ id: "projection-1" })

            expect(manager.findOne).toHaveBeenCalledWith(@@Name@@ProjectionEntity, {
                where: { id: "projection-1" },
            })
        })

        it("answers null when no row was computed", async () => {
            const { projection, manager } = await build()
            manager.findOne.mockResolvedValue(null)

            await expect(projection.get@@Name@@("missing-projection")).resolves.toBeNull()
        })
    })
})
