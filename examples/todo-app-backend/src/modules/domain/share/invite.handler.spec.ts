import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    POSTGRESQL_PRIMARY,
} from "@modules/platform/databases/postgresql/primary/index"
import {
    ShareInvitationEntity,
} from "@modules/platform/databases/postgresql/primary/index"
import {
    createFakeEntityManager,
} from "@modules/platform/databases/postgresql/primary/index"
import {
    CollaboratorCache 
} from "./collaborator-cache"
import {
    InvitationService 
} from "./invitation.service"
import {
    InviteCommand 
} from "./invite.command"
import {
    InviteHandler 
} from "./invite.handler"

describe("InviteHandler",
    () => {
        let moduleRef: TestingModule
        let handler: InviteHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    InviteHandler,
                    InvitationService,
                    CollaboratorCache,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<ShareInvitationEntity>("id"),
                    },
                ],
            }).compile()
            handler = moduleRef.get(InviteHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.share.invite: dispatches to InvitationService and returns the pending invitation",
            async () => {
                const result = await handler.execute(new InviteCommand({
                    ownerId: "owner-1", taskId: "task-1", email: "collab@example.com", role: "editor" 
                }))
                expect(result.status).toBe("pending")
                expect(result.role).toBe("editor")
                expect(result.taskId).toBe("task-1")
                expect(result.invitationId).toBeTruthy()
            })
    })
