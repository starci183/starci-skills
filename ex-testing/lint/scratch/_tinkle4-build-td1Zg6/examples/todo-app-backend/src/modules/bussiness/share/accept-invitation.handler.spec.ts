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
    AcceptInvitationCommand 
} from "./accept-invitation.command"
import {
    AcceptInvitationHandler 
} from "./accept-invitation.handler"

describe("AcceptInvitationHandler",
    () => {
        let moduleRef: TestingModule
        let invitationService: InvitationService
        let handler: AcceptInvitationHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    AcceptInvitationHandler,
                    InvitationService,
                    CollaboratorCache,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<ShareInvitationEntity>("id"),
                    },
                ],
            }).compile()
            invitationService = moduleRef.get(InvitationService)
            handler = moduleRef.get(AcceptInvitationHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.share.accept: accepting a pending invitation activates the role immediately",
            async () => {
                const invited = await invitationService.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "viewer")
                const result = await handler.execute(new AcceptInvitationCommand({
                    actorId: "person-1", invitationId: invited.id, email: "collab@example.com" 
                }))
                expect(result.status).toBe("accepted")
                expect(result.role).toBe("viewer")
            })

        it("fr.share.accept exceptionFlows: a mismatched email is refused",
            async () => {
                const invited = await invitationService.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "viewer")
                await expect(
                    handler.execute(new AcceptInvitationCommand({
                        actorId: "person-1", invitationId: invited.id, email: "wrong@example.com" 
                    })),
                ).rejects.toMatchObject({
                    code: "SHARE_EMAIL_MISMATCH_EXCEPTION" 
                })
            })
    })
