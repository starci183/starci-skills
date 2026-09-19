import "reflect-metadata"
import {
    HttpException 
} from "@nestjs/common"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    AppConfigService 
} from "@modules/platform/config/identity/app-config.service"
import {
    RedisPrimaryClient 
} from "@modules/platform/caches/redis/primary/redis.client"
import {
    AccountService 
} from "@modules/bussiness/account/account.service"
import {
    SessionRepository 
} from "@modules/bussiness/session/session.repository"
import {
    SessionService 
} from "@modules/bussiness/session/session.service"

import {
    SignInInput 
} from "./graphql-types/input"
import {
    SignInResolver 
} from "./sign-in.resolver"

/**
 * br.identity.sign-in in unit form, after the GraphQL migration: the resolver drives the real
 * SessionService over an in-memory stand-in for the Redis store (the real-server round-trip is
 * integration.checkout.redis's own proof, and the full wire shape is scripts/live-proof.mjs).
 * The credential check itself is faked at its answer - PasswordPolicy.verify is covered against
 * the seeded hash in password.policy.spec.ts.
 */
function inMemoryRedis(): RedisPrimaryClient {
    const store = new Map<string, string>()
    return {
        async store(key: string, value: string): Promise<void> {
            store.set(key,
                value)
        },
        async lookup(key: string): Promise<string | null> {
            return store.get(key) ?? null
        },
        async forget(key: string): Promise<void> {
            store.delete(key)
        },
    } as unknown as RedisPrimaryClient
}

interface AccountBoundary {
  verifyCredentials: jest.Mock;
}

async function signInModule(accounts: AccountBoundary): Promise<{ resolver: SignInResolver }> {
    const module: TestingModule = await Test.createTestingModule({
        providers: [
            SignInResolver,
            SessionService,
            SessionRepository,
            {
                provide: RedisPrimaryClient, useValue: inMemoryRedis() 
            },
            {
                provide: AppConfigService, useValue: {
                    getSessionTtlSeconds: () => 60 
                } 
            },
            {
                provide: AccountService, useValue: accounts 
            },
        ],
    }).compile()
    return {
        resolver: module.get(SignInResolver) 
    }
}

function accountsBoundary(verifyAnswer: string | null): AccountBoundary {
    return {
        verifyCredentials: jest.fn().mockResolvedValue(verifyAnswer) 
    }
}

describe("SignInResolver - br.identity.sign-in",
    () => {
        it("ac.identity.sign-in.known-pair-issues-a-session-token",
            async () => {
                const { resolver } = await signInModule(accountsBoundary("person-1"))
                const input = {
                    email: "demo@ecommerce.dev", password: "ecommerce-demo" 
                } as SignInInput
                const first = await resolver.signIn(input)
                expect(typeof first.sessionToken).toBe("string")
                expect(first.personId).toBe("person-1")
                const second = await resolver.signIn(input)
                expect(second.sessionToken).not.toBe(first.sessionToken)
            })

        it("ac.identity.sign-in.wrong-pair-is-refused-alike",
            async () => {
                const { resolver } = await signInModule(accountsBoundary(null))
                const refusals: Array<{ status: number; body: unknown }> = []
                for (const input of [
                    {
                        email: "demo@ecommerce.dev", password: "wrong-password" 
                    },
                    {
                        email: "nobody@ecommerce.dev", password: "ecommerce-demo" 
                    },
                ]) {
                    try {
                        await resolver.signIn(input as SignInInput)
                        throw new Error("sign-in should have been refused")
                    } catch (error) {
                        expect(error).toBeInstanceOf(HttpException)
                        const http = error as HttpException
                        refusals.push({
                            status: http.getStatus(), body: http.getResponse() 
                        })
                    }
                }
                // Unknown email and wrong password refuse indistinguishably - same status, same body.
                expect(refusals[0]).toEqual(refusals[1])
                expect(refusals[0].status).toBe(401)
                expect(refusals[0].body).toEqual({
                    code: "INVALID_CREDENTIALS_EXCEPTION", message: "The email and password pair is not recognized." 
                })
            })

        it("fr.identity.sign-in refuses a request missing a half before any credential check",
            async () => {
                const accounts = accountsBoundary("person-1")
                const { resolver } = await signInModule(accounts)
                try {
                    await resolver.signIn({
                        email: "demo@ecommerce.dev" 
                    } as SignInInput)
                    throw new Error("the request should have been refused")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(400)
                    expect((error as HttpException).getResponse()).toEqual({
                        code: "REQUEST_INVALID_EXCEPTION", message: "email and password are required." 
                    })
                }
                expect(accounts.verifyCredentials).not.toHaveBeenCalled()
            })
    })
