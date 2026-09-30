import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { invitationRow } from "@tests/fixtures/builders/share.builder"
import { AccessService } from "./access.service"
import { InvitationEntity } from "./persistence/entities/invitation.entity"

const editor = invitationRow({
    status: "accepted",
    acceptedAt: new Date("2026-09-02T10:00:00.000Z"),
    personId: "ann",
})

const build = async (manager: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AccessService, { provide: PRIMARY_ENTITY_MANAGER, useValue: manager }],
    }).compile()
    return moduleRef.get(AccessService)
}

describe("AccessService", () => {
    describe("mayComplete", () => {
        it("lets the owner complete without asking the database", async () => {
            const access = await build(mockEntityManager())

            await expect(access.mayComplete({ actorId: "owner-1", taskId: "t-1", ownerId: "owner-1" })).resolves.toBe(true)
        })

        it("lets an accepted editor of that task and owner complete, reading the row from the database", async () => {
            const manager = mockEntityManager({ findOneBy: [InvitationEntity, editor] })
            const access = await build(manager)

            await expect(access.mayComplete({ actorId: "ann", taskId: "t-1", ownerId: "owner-1" })).resolves.toBe(true)
            expect(manager.findOneBy).toHaveBeenCalledWith(InvitationEntity, {
                taskId: "t-1",
                ownerId: "owner-1",
                personId: "ann",
                status: "accepted",
                role: "editor",
            })
        })

        it("refuses a viewer, a revoked or foreign collaborator and a stranger, who match no editor row", async () => {
            const access = await build(mockEntityManager({ findOneBy: [InvitationEntity, null] }))

            await expect(access.mayComplete({ actorId: "stranger", taskId: "t-1", ownerId: "owner-1" })).resolves.toBe(false)
        })
    })
})
