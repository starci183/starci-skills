import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    SessionNotFoundException 
} from "@modules/shared/exceptions/errors/session/session-not-found"
import {
    SessionRecord 
} from "@modules/bussiness/session/types/session-record"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    RevokeCollaboratorCommand 
} from "@modules/bussiness/share/revoke-collaborator.command"
import {
    ShareForbiddenException 
} from "@modules/shared/exceptions/errors/share/forbidden"
import {
    ShareInvitationNotFoundException 
} from "@modules/shared/exceptions/errors/share/invitation-not-found"

import {
    RevokeCollaboratorInput 
} from "./graphql-types/input"
import {
    RevokeCollaboratorResolver 
} from "./revoke-collaborator.resolver"

const req = {
    headers: {
        authorization: "Bearer token-1" 
    } 
}
const activeSession = new SessionRecord("token-1",
    "owner-1",
    new Date(),
    new Date(Date.now() + 60_000))

describe("RevokeCollaboratorResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: RevokeCollaboratorResolver
        let commandBus: { execute: jest.Mock }
        let sessionService: { findActive: jest.Mock }

        beforeEach(async () => {
            commandBus = {
                execute: jest.fn() 
            }
            sessionService = {
                findActive: jest.fn().mockResolvedValue(activeSession) 
            }
            moduleRef = await Test.createTestingModule({
                providers: [
                    RevokeCollaboratorResolver,
                    {
                        provide: CommandBus, useValue: commandBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(RevokeCollaboratorResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.share.revoke: resolves the owner, maps the input onto the command and returns the revoked invitation",
            async () => {
                commandBus.execute.mockResolvedValue({
                    invitationId: "inv-1", status: "revoked" 
                })
                const input: RevokeCollaboratorInput = {
                    invitationId: "inv-1" 
                }

                const response = await resolver.revokeCollaborator(req,
                    input)

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const command = commandBus.execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(RevokeCollaboratorCommand)
                expect(command.params).toEqual({
                    ownerId: "owner-1", invitationId: "inv-1" 
                })
                expect(response).toMatchObject({
                    invitationId: "inv-1", status: "revoked" 
                })
            })

        it("refuses before dispatching any command when the session cannot be resolved",
            async () => {
                sessionService.findActive.mockRejectedValue(new SessionNotFoundException())

                await expect(resolver.revokeCollaborator(req,
                    {
                        invitationId: "inv-1" 
                    })).rejects.toMatchObject({
                    code: "SESSION_NOT_FOUND_EXCEPTION",
                })
                expect(commandBus.execute).not.toHaveBeenCalled()
            })

        it("propagates SHARE_INVITATION_NOT_FOUND from the handler unchanged",
            async () => {
                commandBus.execute.mockRejectedValue(new ShareInvitationNotFoundException({
                    invitationId: "inv-1" 
                }))

                await expect(resolver.revokeCollaborator(req,
                    {
                        invitationId: "inv-1" 
                    })).rejects.toMatchObject({
                    code: "SHARE_INVITATION_NOT_FOUND_EXCEPTION",
                })
            })

        it("propagates SHARE_FORBIDDEN when the invitation belongs to somebody else’s task",
            async () => {
                commandBus.execute.mockRejectedValue(new ShareForbiddenException({
                    invitationId: "inv-1", actorId: "owner-1" 
                }))

                await expect(resolver.revokeCollaborator(req,
                    {
                        invitationId: "inv-1" 
                    })).rejects.toMatchObject({
                    code: "SHARE_FORBIDDEN_EXCEPTION",
                })
            })
    })
