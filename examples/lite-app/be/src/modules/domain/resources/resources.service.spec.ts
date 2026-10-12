import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ResourcesErrorCode } from "./errors/resources.error"
import { FIND_RESOURCES } from "./persistence/resources.sql"
import { ResourcesService } from "./resources.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ResourcesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ResourcesService)
}

describe("ResourcesService", () => {
    describe("resources", () => {
        it("returns the resource the principal owns", async () => {
            const em = mockEntityManager({ query: [FIND_RESOURCES, [{ id: "resource-1" }]] })

            await expect((await build(em)).resources("person-1", "resource-1")).resolves.toEqual({ id: "resource-1" })
            expect(em.query).toHaveBeenCalledWith(FIND_RESOURCES, ["resource-1", "person-1"])
        })

        it("answers not found for a resource that is absent or owned by someone else", async () => {
            const em = mockEntityManager({ query: [FIND_RESOURCES, []] })

            await expect((await build(em)).resources("person-1", "resource-9")).rejects.toMatchObject({
                code: ResourcesErrorCode.NotFound,
                params: { id: "resource-9" },
            })
        })
    })
})
