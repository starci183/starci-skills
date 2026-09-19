import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    ShareInvitationEntity 
} from "@modules/platform/databases/postgresql/primary/entities/share-invitation.entity"
import {
    createFakeEntityManager 
} from "@modules/platform/databases/postgresql/primary/testing/fake-entity-manager"
import {
    CollaboratorCache 
} from "./collaborator-cache"
import {
    InvitationService 
} from "./invitation.service"

const DAY_MS = 24 * 60 * 60 * 1000
const PRIMARY_ENTITY_MANAGER = getEntityManagerToken(POSTGRESQL_PRIMARY)

describe("InvitationService",
    () => {
        let moduleRef: TestingModule
        let entityManager: ReturnType<typeof createFakeEntityManager<ShareInvitationEntity>>
        let cache: CollaboratorCache
        let service: InvitationService

        beforeEach(async () => {
            entityManager = createFakeEntityManager<ShareInvitationEntity>("id")
            moduleRef = await Test.createTestingModule({
                providers: [
                    InvitationService,
                    CollaboratorCache,
                    {
                        provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager 
                    },
                ],
            }).compile()
            cache = moduleRef.get(CollaboratorCache)
            service = moduleRef.get(InvitationService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.share.invite: creates a pending invitation bound to the task, email and role",
            async () => {
                const record = await service.invite("owner-1",
                    "task-1",
                    "Editor@Example.com",
                    "editor")
                expect(record.status).toBe("pending")
                expect(record.email).toBe("editor@example.com")
                expect(record.role).toBe("editor")
                expect(record.taskId).toBe("task-1")
            })

        it("fr.share.invite exceptionFlows: an invalid email is refused and nothing is created",
            async () => {
                await expect(service.invite("owner-1",
                    "task-1",
                    "not-an-email",
                    "editor")).rejects.toMatchObject({
                    code: "SHARE_INVALID_EMAIL_EXCEPTION",
                })
            })

        it("fr.share.invite exceptionFlows: a role other than viewer or editor is refused",
            async () => {
                await expect(service.invite("owner-1",
                    "task-1",
                    "someone@example.com",
                    "admin")).rejects.toMatchObject({
                    code: "SHARE_INVALID_ROLE_EXCEPTION",
                })
            })

        it("data.share.invitation invariant: a second invite to the same pending pair is refused",
            async () => {
                await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "viewer")
                await expect(service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "editor")).rejects.toMatchObject({
                    code: "SHARE_INVITATION_ALREADY_EXISTS_EXCEPTION",
                })
            })

        it("ac.share.invite.expiry.accept-before-expiry-succeeds: accepting thirteen days in still succeeds",
            async () => {
                const invited = await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "editor")
                await backdateSentAt(invited.id,
                    13)

                const accepted = await service.accept("person-1",
                    invited.id,
                    "collab@example.com")
                expect(accepted.status).toBe("accepted")
                expect(accepted.role).toBe("editor")
            })

        it("ac.share.invite.expiry.expires-after-14-days: reading fifteen days later reports expired and refuses acceptance",
            async () => {
                const invited = await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "editor")
                await backdateSentAt(invited.id,
                    15)

                await expect(service.accept("person-1",
                    invited.id,
                    "collab@example.com")).rejects.toMatchObject({
                    code: "SHARE_INVITATION_EXPIRED_EXCEPTION",
                })
                const stored = await entityManager.findOneBy(ShareInvitationEntity,
                    {
                        id: invited.id 
                    })
                expect(stored?.status).toBe("expired")
            })

        it("fr.share.accept exceptionFlows: accepting with a different email is refused",
            async () => {
                const invited = await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "viewer")
                await expect(service.accept("person-1",
                    invited.id,
                    "somebody-else@example.com")).rejects.toMatchObject({
                    code: "SHARE_EMAIL_MISMATCH_EXCEPTION",
                })
            })

        it("fr.share.accept exceptionFlows: accepting a revoked invitation is refused",
            async () => {
                const invited = await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "viewer")
                await service.revoke("owner-1",
                    invited.id)
                await expect(service.accept("person-1",
                    invited.id,
                    "collab@example.com")).rejects.toMatchObject({
                    code: "SHARE_INVITATION_REVOKED_EXCEPTION",
                })
            })

        it("ac.share.revoke.on-read.removed-loses-access-next-read: revoke clears the collaborator cache immediately",
            async () => {
                const invited = await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "editor")
                await service.accept("person-1",
                    invited.id,
                    "collab@example.com")
                expect(cache.roleOf("task-1",
                    "person-1").role).toBe("editor")

                await service.revoke("owner-1",
                    invited.id)
                expect(cache.roleOf("task-1",
                    "person-1").role).toBeNull()
            })

        it("fr.share.revoke exceptionFlows: revoking an already revoked invitation is refused",
            async () => {
                const invited = await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "viewer")
                await service.revoke("owner-1",
                    invited.id)
                await expect(service.revoke("owner-1",
                    invited.id)).rejects.toMatchObject({
                    code: "SHARE_INVITATION_ALREADY_CLOSED_EXCEPTION",
                })
            })

        it("fr.share.revoke: only the owner may revoke",
            async () => {
                const invited = await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "viewer")
                await expect(service.revoke("someone-else",
                    invited.id)).rejects.toMatchObject({
                    code: "SHARE_FORBIDDEN_EXCEPTION" 
                })
            })

        it("fr.share.list exceptionFlows: a stranger sees nothing",
            async () => {
                await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "viewer")
                const list = await service.listFor("a-stranger",
                    "task-1")
                expect(list).toEqual([])
            })

        it("fr.share.list: the owner sees every row with a live status",
            async () => {
                await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "viewer")
                const list = await service.listFor("owner-1",
                    "task-1")
                expect(list).toHaveLength(1)
                expect(list[0].status).toBe("pending")
            })

        it("fr.share.list: a bound collaborator sees the list too",
            async () => {
                const invited = await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "editor")
                await service.accept("person-1",
                    invited.id,
                    "collab@example.com")
                const list = await service.listFor("person-1",
                    "task-1")
                expect(list).toHaveLength(1)
                expect(list[0].status).toBe("accepted")
            })

        it("fr.share.list postconditions: an expired row reads expired at read time, never cached",
            async () => {
                const invited = await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "viewer")
                await backdateSentAt(invited.id,
                    20)
                const list = await service.listFor("owner-1",
                    "task-1")
                expect(list[0].status).toBe("expired")
            })

        it("re-inviting an expired address re-opens a fresh pending row instead of a second one",
            async () => {
                const invited = await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "viewer")
                await backdateSentAt(invited.id,
                    20)
                await service.listFor("owner-1",
                    "task-1") // reconciles to expired
                const reinvited = await service.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "editor")
                expect(reinvited.id).toBe(invited.id)
                expect(reinvited.status).toBe("pending")
                expect(reinvited.role).toBe("editor")
            })

        async function backdateSentAt(invitationId: string, days: number): Promise<void> {
            const row = await entityManager.findOneBy(ShareInvitationEntity,
                {
                    id: invitationId 
                })
            if (!row) throw new Error("row not found")
            row.sentAt = new Date(Date.now() - days * DAY_MS)
            await entityManager.save(ShareInvitationEntity,
                row)
        }
    })
