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
    ListCollaboratorsQuery 
} from "./list-collaborators.query"
import {
    ListCollaboratorsHandler 
} from "./list-collaborators.handler"

describe("ListCollaboratorsHandler",
    () => {
        let moduleRef: TestingModule
        let invitationService: InvitationService
        let handler: ListCollaboratorsHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    ListCollaboratorsHandler,
                    InvitationService,
                    CollaboratorCache,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<ShareInvitationEntity>("id"),
                    },
                ],
            }).compile()
            invitationService = moduleRef.get(InvitationService)
            handler = moduleRef.get(ListCollaboratorsHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.share.list: the owner sees every collaborator with a live status",
            async () => {
                await invitationService.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "editor")
                const result = await handler.execute(new ListCollaboratorsQuery({
                    actorId: "owner-1", taskId: "task-1" 
                }))
                expect(result.collaborators).toHaveLength(1)
                expect(result.collaborators[0].status).toBe("pending")
            })

        it("fr.share.list exceptionFlows: a stranger sees nothing",
            async () => {
                await invitationService.invite("owner-1",
                    "task-1",
                    "collab@example.com",
                    "editor")
                const result = await handler.execute(new ListCollaboratorsQuery({
                    actorId: "a-stranger", taskId: "task-1" 
                }))
                expect(result.collaborators).toEqual([])
            })
    })
