import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    CommandBus 
} from "@nestjs/cqrs"
import {
    InvalidCredentialsException 
} from "@modules/shared/exceptions/errors/session/invalid-credentials"
import {
    SignInCommand 
} from "@modules/bussiness/session/sign-in.command"

import {
    SignInInput 
} from "./graphql-types/input"
import {
    SignInResolver 
} from "./sign-in.resolver"

describe("SignInResolver",
    () => {
        let moduleRef: TestingModule
        let resolver: SignInResolver
        let commandBus: { execute: jest.Mock }

        beforeEach(async () => {
            commandBus = {
                execute: jest.fn() 
            }
            moduleRef = await Test.createTestingModule({
                providers: [SignInResolver,
                    {
                        provide: CommandBus, useValue: commandBus 
                    }],
            }).compile()
            resolver = moduleRef.get(SignInResolver)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("br.login.password.sign-in: dispatches SignInCommand with the input mapped to params and returns the issued session",
            async () => {
                commandBus.execute.mockResolvedValue({
                    sessionToken: "token-1", personId: "person-1" 
                })
                const input: SignInInput = {
                    email: "person@example.com", password: "correct-horse" 
                }

                const response = await resolver.signIn(input)

                expect(commandBus.execute).toHaveBeenCalledTimes(1)
                const command = commandBus.execute.mock.calls[0][0]
                expect(command).toBeInstanceOf(SignInCommand)
                expect(command.params).toEqual({
                    email: "person@example.com", password: "correct-horse" 
                })
                expect(response.sessionToken).toBe("token-1")
                expect(response.personId).toBe("person-1")
            })

        it("ac.login.password.sign-in.wrong-pair-is-refused: the handler refusal propagates to the caller unchanged",
            async () => {
                commandBus.execute.mockRejectedValue(new InvalidCredentialsException())

                await expect(resolver.signIn({
                    email: "person@example.com", password: "wrong" 
                })).rejects.toMatchObject({
                    code: "INVALID_CREDENTIALS_EXCEPTION",
                })
            })
    })
