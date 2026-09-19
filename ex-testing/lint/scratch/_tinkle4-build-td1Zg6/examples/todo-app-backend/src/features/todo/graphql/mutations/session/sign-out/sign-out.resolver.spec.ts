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
    SignOutCommand 
} from "@modules/bussiness/session/sign-out.command"

import {
    SignOutInput 
} from "./graphql-types/input"
import {
    SignOutResolver 
} from "./sign-out.resolver"

describe("SignOutResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: SignOutResolver
        let commandBus: { execute: jest.Mock }

        beforeEach(async () => {
            commandBus = {
                execute: jest.fn() 
            }
            moduleRef = await Test.createTestingModule({
                providers: [SignOutResolver,
                    {
                        provide: CommandBus, useValue: commandBus 
                    }],
            }).compile()
            resolver = moduleRef.get(SignOutResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("fr.login.sign-out: dispatches SignOutCommand with the token from the input and reports the result",
            async () => {
                commandBus.execute.mockResolvedValue({
                    signedOut: true 
                })
                const input: SignOutInput = {
                    sessionToken: "token-1" 
                }

                const response = await resolver.signOut(input)

                expect(commandBus.execute).toHaveBeenCalledTimes(1)
                const command = commandBus.execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(SignOutCommand)
                expect(command.params).toEqual({
                    sessionToken: "token-1" 
                })
                expect(response.signedOut).toBe(true)
            })

        it("propagates the refusal when the token does not name an active session",
            async () => {
                commandBus.execute.mockRejectedValue(new SessionNotFoundException())

                await expect(resolver.signOut({
                    sessionToken: "no-such-token" 
                })).rejects.toMatchObject({
                    code: "SESSION_NOT_FOUND_EXCEPTION",
                })
            })
    })
