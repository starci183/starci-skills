import { mockEntityManager } from "@tests/fixtures/database"
import { AccessService } from "./access.service"
import { InvitationEntity } from "./persistence/entities/invitation.entity"

const accepted: InvitationEntity = {
    id: "i1",
    taskId: "t1",
    ownerId: "owner-1",
    email: "ann@example.com",
    role: "editor",
    status: "accepted",
    sentAt: new Date("2026-09-01T10:00:00.000Z"),
    acceptedAt: new Date("2026-09-02T10:00:00.000Z"),
    revokedAt: null,
    personId: "ann",
}

describe("AccessService.mayComplete", () => {
    it("lets the owner complete without asking the database", async () => {
        const entityManager = mockEntityManager()
        await expect(new AccessService(entityManager).mayComplete({ actorId: "owner-1", taskId: "t1", ownerId: "owner-1" })).resolves.toBe(true)
        expect(entityManager.findOneBy).not.toHaveBeenCalled()
    })

    it("lets an accepted editor of that task and owner complete, reading the row from the database", async () => {
        const entityManager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(accepted) })
        await expect(new AccessService(entityManager).mayComplete({ actorId: "ann", taskId: "t1", ownerId: "owner-1" })).resolves.toBe(true)
        expect(entityManager.findOneBy).toHaveBeenCalledWith(InvitationEntity, {
            taskId: "t1",
            ownerId: "owner-1",
            personId: "ann",
            status: "accepted",
            role: "editor",
        })
    })

    it("refuses a viewer, a revoked or foreign collaborator and a stranger, all of which match no editor row", async () => {
        const entityManager = mockEntityManager({ findOneBy: jest.fn().mockResolvedValue(null) })
        await expect(new AccessService(entityManager).mayComplete({ actorId: "viewer", taskId: "t1", ownerId: "owner-1" })).resolves.toBe(false)
    })
})
