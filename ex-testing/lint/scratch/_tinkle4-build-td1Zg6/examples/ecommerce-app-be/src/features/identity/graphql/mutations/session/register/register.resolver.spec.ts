import "reflect-metadata"
import {
    HttpException 
} from "@nestjs/common"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AccountService 
} from "@modules/bussiness/account/account.service"

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
        const accounts = {
            register: jest.fn() 
        }

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
                try {
                    await resolver.register({
                        email: "demo@ecommerce.dev", password: "ecommerce-demo" 
                    } as RegisterInput)
                    throw new Error("the request should have been refused")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(409)
                    expect((error as HttpException).getResponse()).toEqual({
                        code: "EMAIL_TAKEN_EXCEPTION", message: "An account already answers this email." 
                    })
                }
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
                try {
                    await resolver.register(input as RegisterInput)
                    throw new Error("the request should have been refused")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(400)
                    expect((error as HttpException).getResponse()).toEqual({
                        code: "REQUEST_INVALID_EXCEPTION",
                        message: "A plausible email and a password of at least 8 characters are required.",
                    })
                }
                expect(accounts.register).not.toHaveBeenCalled()
            })
    })
