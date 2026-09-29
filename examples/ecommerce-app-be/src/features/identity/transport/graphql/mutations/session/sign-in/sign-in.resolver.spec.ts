import "reflect-metadata"
import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    IdentityConfigService 
} from "@modules/platform/config/index"
import {
    RedisPrimaryClient 
} from "@modules/platform/caches/index"
import {
    AccountService 
} from "@modules/domain/account/index"
import {
    SessionRepository, SessionService 
} from "@modules/domain/session/index"
import {
    InvalidCredentialsException 
} from "@modules/platform/errors/index"

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
    return mock<RedisPrimaryClient>({
        store: jest.fn(async (key: string, value: string): Promise<void> => {
            store.set(key,
                value)
        }),
        lookup: jest.fn(async (key: string): Promise<string | null> => store.get(key) ?? null),
        forget: jest.fn(async (key: string): Promise<void> => {
            store.delete(key)
        }),
    })
}

async function signInModule(accounts: AccountService): Promise<{ resolver: SignInResolver }> {
    const module: TestingModule = await Test.createTestingModule({
        providers: [
            SignInResolver,
            SessionService,
            SessionRepository,
            {
                provide: RedisPrimaryClient, useValue: inMemoryRedis() 
            },
            {
                provide: IdentityConfigService, useValue: mock<IdentityConfigService>({
                    getSessionTtlSeconds: () => 60 
                })
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

function accountsBoundary(verifyAnswer: string | null): AccountService {
    return mock<AccountService>({
        verifyCredentials: jest.fn().mockResolvedValue(verifyAnswer) 
    })
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
                const refusals: Array<unknown> = []
                for (const input of [
                    {
                        email: "demo@ecommerce.dev", password: "wrong-password" 
                    },
                    {
                        email: "nobody@ecommerce.dev", password: "ecommerce-demo" 
                    },
                ]) {
                    refusals.push(await resolver.signIn(input as SignInInput).catch((error: unknown) => error))
                }
                // Unknown email and wrong password refuse indistinguishably - same code, same sentence.
                expect(refusals[0]).toBeInstanceOf(InvalidCredentialsException)
                expect(refusals[1]).toBeInstanceOf(InvalidCredentialsException)
                expect(refusals[0]).toMatchObject({
                    code: "INVALID_CREDENTIALS_EXCEPTION", message: "The email and password pair is not recognized." 
                })
                expect(refusals[1]).toMatchObject(refusals[0] as object)
            })

        it("fr.identity.sign-in refuses a request missing a half before any credential check",
            async () => {
                const accounts = accountsBoundary("person-1")
                const { resolver } = await signInModule(accounts)
                await expect(resolver.signIn({
                    email: "demo@ecommerce.dev" 
                } as SignInInput)).rejects.toMatchObject({
                    code: "REQUEST_INVALID_EXCEPTION", message: "email and password are required." 
                })
                expect(accounts.verifyCredentials).not.toHaveBeenCalled()
            })
    })
