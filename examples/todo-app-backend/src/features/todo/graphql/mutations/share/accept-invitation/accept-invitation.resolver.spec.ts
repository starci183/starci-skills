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
    AcceptInvitationCommand 
} from "@modules/bussiness/share/accept-invitation.command"
import {
    ShareEmailMismatchException 
} from "@modules/shared/exceptions/errors/share/email-mismatch"
import {
    ShareInvitationNotFoundException 
} from "@modules/shared/exceptions/errors/share/invitation-not-found"

import {
    AcceptInvitationInput 
} from "./graphql-types/input"
import {
    AcceptInvitationResolver 
} from "./accept-invitation.resolver"

const req = {
    headers: {
        authorization: "Bearer token-1" 
    } 
}
const activeSession = new SessionRecord("token-1",
    "invitee-1",
    new Date(),
    new Date(Date.now() + 60_000))

describe("AcceptInvitationResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: AcceptInvitationResolver
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
                    AcceptInvitationResolver,
                    {
                        provide: CommandBus, useValue: commandBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(AcceptInvitationResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.share.accept: resolves the caller, maps the input onto the command and returns the accepted invitation",
            async () => {
                commandBus.execute.mockResolvedValue({
                    invitationId: "inv-1", role: "editor", status: "accepted" 
                })
                const input: AcceptInvitationInput = {
                    invitationId: "inv-1", email: "friend@example.com" 
                }

                const response = await resolver.acceptInvitation(req,
                    input)

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const command = commandBus.execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(AcceptInvitationCommand)
                expect(command.params).toEqual({
                    actorId: "invitee-1", invitationId: "inv-1", email: "friend@example.com" 
                })
                expect(response).toMatchObject({
                    invitationId: "inv-1", role: "editor", status: "accepted" 
                })
            })

        it("refuses before dispatching any command when the session cannot be resolved",
            async () => {
                sessionService.findActive.mockRejectedValue(new SessionNotFoundException())

                await expect(
                    resolver.acceptInvitation(req,
                        {
                            invitationId: "inv-1", email: "friend@example.com" 
                        }),
                ).rejects.toMatchObject({
                    code: "SESSION_NOT_FOUND_EXCEPTION" 
                })
                expect(commandBus.execute).not.toHaveBeenCalled()
            })

        it("propagates SHARE_INVITATION_NOT_FOUND from the handler unchanged",
            async () => {
                commandBus.execute.mockRejectedValue(new ShareInvitationNotFoundException({
                    invitationId: "inv-1" 
                }))

                await expect(
                    resolver.acceptInvitation(req,
                        {
                            invitationId: "inv-1", email: "friend@example.com" 
                        }),
                ).rejects.toMatchObject({
                    code: "SHARE_INVITATION_NOT_FOUND_EXCEPTION" 
                })
            })

        it("propagates SHARE_EMAIL_MISMATCH when the invitation was addressed to another email",
            async () => {
                commandBus.execute.mockRejectedValue(new ShareEmailMismatchException({
                    invitationId: "inv-1" 
                }))

                await expect(
                    resolver.acceptInvitation(req,
                        {
                            invitationId: "inv-1", email: "other@example.com" 
                        }),
                ).rejects.toMatchObject({
                    code: "SHARE_EMAIL_MISMATCH_EXCEPTION" 
                })
            })
    })
