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
import {
    RevokeCollaboratorCommand 
} from "./revoke-collaborator.command"
import {
    RevokeCollaboratorHandler 
} from "./revoke-collaborator.handler"

describe("RevokeCollaboratorHandler",
    () => {
        let moduleRef: TestingModule
        let invitationService: InvitationService
        let handler: RevokeCollaboratorHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    RevokeCollaboratorHandler,
                    InvitationService,
                    CollaboratorCache,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<ShareInvitationEntity>("id"),
                    },
                ],
            }).compile()
            invitationService = moduleRef.get(InvitationService)
            handler = moduleRef.get(RevokeCollaboratorHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.share.revoke: the owner revokes a collaborator",
            async () => {
                const invited = await invitationService.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "editor")
                const result = await handler.execute(new RevokeCollaboratorCommand({
                    ownerId: "owner-1", invitationId: invited.id 
                }))
                expect(result.status).toBe("revoked")
            })

        it("fr.share.revoke: a non-owner is refused",
            async () => {
                const invited = await invitationService.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "editor")
                await expect(
                    handler.execute(new RevokeCollaboratorCommand({
                        ownerId: "someone-else", invitationId: invited.id 
                    })),
                ).rejects.toMatchObject({
                    code: "SHARE_FORBIDDEN_EXCEPTION" 
                })
            })
    })
