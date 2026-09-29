import "reflect-metadata"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    AccountService 
} from "@modules/domain/account/index"

import {
    RegisterInput 
} from "./graphql-types/input"
import {
    RegisterResolver 
} from "./register.resolver"

/**
 * The demo signup door in unit form, after the GraphQL migration: the resolver checks the pair
 * exactly the way the retired REST door did, then hands a plausible registration to the account
 * capability - a taken address comes back as EMAIL_TAKEN and nothing else. The account
 * capability is faked at its answer.
 */
describe("RegisterResolver - the demo signup mutation",
    () => {
        let resolver: RegisterResolver
        const accounts = mock<AccountService>()

        beforeEach(async () => {
            jest.clearAllMocks()
            const module: TestingModule = await Test.createTestingModule({
                providers: [
                    RegisterResolver,
                    {
                        provide: AccountService, useValue: accounts 
                    },
                ],
            }).compile()
            resolver = module.get(RegisterResolver)
        })

        it("registers a fresh visitor and answers the new person id",
            async () => {
                accounts.register.mockResolvedValue("person-new")
                await expect(resolver.register({
                    email: "fresh@ecommerce.dev", password: "fresh-password" 
                } as RegisterInput)).resolves.toEqual({
                    personId: "person-new",
                })
                expect(accounts.register).toHaveBeenCalledWith("fresh@ecommerce.dev",
                    "fresh-password")
            })

        it("a taken address is EMAIL_TAKEN, nothing else",
            async () => {
                accounts.register.mockResolvedValue(null)
                await expect(resolver.register({
                    email: "demo@ecommerce.dev", password: "ecommerce-demo" 
                } as RegisterInput)).rejects.toMatchObject({
                    code: "EMAIL_TAKEN_EXCEPTION", message: "An account already answers this email." 
                })
            })

        it.each([
            [{
                email: "not-an-email", password: "fresh-password" 
            }],
            [{
                email: "fresh@ecommerce.dev", password: "short" 
            }],
            [{
                password: "fresh-password" 
            }],
            [{
            }],
        ])("refuses an implausible register input %j before any account work",
            async (input) => {
                accounts.register.mockResolvedValue("person-new")
                await expect(resolver.register(input as RegisterInput)).rejects.toMatchObject({
                    code: "REQUEST_INVALID_EXCEPTION",
                    message: "A plausible email and a password of at least 8 characters are required.",
                })
                expect(accounts.register).not.toHaveBeenCalled()
            })
    })
