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
    InviteCommand 
} from "@modules/bussiness/share/invite.command"
import {
    ShareForbiddenException 
} from "@modules/shared/exceptions/errors/share/forbidden"
import {
    ShareInvalidRoleException 
} from "@modules/shared/exceptions/errors/share/invalid-role"

import {
    InviteInput 
} from "./graphql-types/input"
import {
    InviteResolver 
} from "./invite.resolver"

const req = {
    headers: {
        authorization: "Bearer token-1" 
    } 
}
const activeSession = new SessionRecord("token-1",
    "owner-1",
    new Date(),
    new Date(Date.now() + 60_000))

describe("InviteResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: InviteResolver
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
                    InviteResolver,
                    {
                        provide: CommandBus, useValue: commandBus 
                    },
                    {
                        provide: SessionService, useValue: sessionService 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(InviteResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.share.invite: resolves the owner, maps the input onto the command and returns the invitation",
            async () => {
                commandBus.execute.mockResolvedValue({
                    invitationId: "inv-1",
                    taskId: "task-1",
                    email: "friend@example.com",
                    role: "editor",
                    status: "pending",
                })
                const input: InviteInput = {
                    taskId: "task-1", email: "friend@example.com", role: "editor" 
                }

                const response = await resolver.invite(req,
                    input)

                expect(sessionService.findActive).toHaveBeenCalledWith("token-1")
                const command = commandBus.execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(InviteCommand)
                expect(command.params).toEqual({
                    ownerId: "owner-1",
                    taskId: "task-1",
                    email: "friend@example.com",
                    role: "editor",
                })
                expect(response).toMatchObject({
                    invitationId: "inv-1",
                    taskId: "task-1",
                    email: "friend@example.com",
                    role: "editor",
                    status: "pending",
                })
            })

        it("refuses before dispatching any command when the session cannot be resolved",
            async () => {
                sessionService.findActive.mockRejectedValue(new SessionNotFoundException())

                await expect(
                    resolver.invite(req,
                        {
                            taskId: "task-1", email: "friend@example.com", role: "editor" 
                        }),
                ).rejects.toMatchObject({
                    code: "SESSION_NOT_FOUND_EXCEPTION" 
                })
                expect(commandBus.execute).not.toHaveBeenCalled()
            })

        it("br.share.role.permissions: the role refusal stays at the business boundary and propagates unchanged",
            async () => {
                commandBus.execute.mockRejectedValue(new ShareInvalidRoleException({
                    role: "owner" 
                }))

                await expect(
                    resolver.invite(req,
                        {
                            taskId: "task-1", email: "friend@example.com", role: "owner" 
                        }),
                ).rejects.toMatchObject({
                    code: "SHARE_INVALID_ROLE_EXCEPTION" 
                })
            })

        it("propagates SHARE_FORBIDDEN when the task belongs to somebody else",
            async () => {
                commandBus.execute.mockRejectedValue(new ShareForbiddenException({
                    actorId: "owner-1" 
                }))

                await expect(
                    resolver.invite(req,
                        {
                            taskId: "task-1", email: "friend@example.com", role: "viewer" 
                        }),
                ).rejects.toMatchObject({
                    code: "SHARE_FORBIDDEN_EXCEPTION" 
                })
            })
    })
