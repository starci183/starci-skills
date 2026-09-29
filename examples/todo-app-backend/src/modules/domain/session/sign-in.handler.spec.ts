import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    AppConfigService,
} from "@modules/platform/config/index"
import {
    SessionService 
} from "./session.service"
import {
    POSTGRESQL_PRIMARY,
} from "@modules/platform/databases/index"
import {
    SessionEntity,
} from "@modules/platform/databases/index"
import {
    createFakeEntityManager,
} from "@modules/platform/databases/index"
import {
    KeycloakClient,
    KeycloakSignInResult,
} from "@modules/integrations/keycloak/index"
import {
    KeycloakInvalidCredentialsException,
} from "@modules/integrations/keycloak/index"
import {
    PlatformEventBus,
} from "@modules/platform/events/index"
import {
    SignedInEvent,
} from "@modules/platform/events/index"
import {
    SignInCommand 
} from "./sign-in.command"
import {
    SignInHandler 
} from "./sign-in.handler"
import {
    Clock 
} from "@modules/platform/clock/index"
import {
    FakeClock 
} from "@starci/jest-preset/clock"
import {
    timingSafeEqual 
} from "node:crypto"

/** Compares two secrets in constant time, the way production code must. */
const sameSecret = (given: string, expected: string): boolean =>
    given.length === expected.length && timingSafeEqual(Buffer.from(given),
        Buffer.from(expected))

/**
 * The sign-in handler now exercises only the Keycloak client boundary: this fake stands in for the real
 * direct access grant round-trip, without asserting anything about how Keycloak itself is implemented.
 */
class FakeKeycloakClient extends KeycloakClient {
    constructor(private readonly accepted: Record<string, string>) {
        super(new AppConfigService())
    }

    async signIn(email: string, password: string): Promise<KeycloakSignInResult> {
        const key = email.toLowerCase()
        const expected = this.accepted[key]
        if (expected === undefined || !sameSecret(password,
            expected)) {
            throw new KeycloakInvalidCredentialsException({
            })
        }
        return {
            subject: `subject-of-${key}` 
        }
    }
}

describe("SignInHandler",
    () => {
        let moduleRef: TestingModule
        let sessionService: SessionService
        let events: PlatformEventBus
        let handler: SignInHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    {
                        provide: Clock, useValue: new FakeClock() 
                    },
                    SignInHandler,
                    SessionService,
                    AppConfigService,
                    PlatformEventBus,
                    {
                        provide: KeycloakClient,
                        useValue: new FakeKeycloakClient({
                            "person@example.com": "correct-horse" 
                        }),
                    },
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<SessionEntity>("token"),
                    },
                ],
            }).compile()
            sessionService = moduleRef.get(SessionService)
            events = moduleRef.get(PlatformEventBus)
            handler = moduleRef.get(SignInHandler)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("ac.login.password.sign-in.wrong-pair-is-refused: a known email with a wrong password is refused and no session is created",
            async () => {
                await expect(handler.execute(new SignInCommand({
                    email: "person@example.com", password: "wrong-password" 
                }))).rejects.toMatchObject({
                    code: "INVALID_CREDENTIALS_EXCEPTION",
                })
            })

        it("br.login.password.sign-in: a sign-in succeeds only when Keycloak accepts the pair",
            async () => {
                const result = await handler.execute(new SignInCommand({
                    email: "person@example.com", password: "correct-horse" 
                }))
                expect(result.sessionToken).toEqual(expect.any(String))
                expect(result.personId).toEqual(expect.any(String))
            })

        it("ac.login.password.sign-in.refusal-does-not-name-the-half: an unknown email and a wrong password carry the same refusal",
            async () => {
                const unknownEmailError = await handler.execute(new SignInCommand({
                    email: "nobody@example.com", password: "anything"
                })).catch((error: unknown) => error)
                const wrongPasswordError = await handler.execute(new SignInCommand({
                    email: "person@example.com", password: "wrong-password"
                })).catch((error: unknown) => error)
                expect((unknownEmailError as Error).message).toBe((wrongPasswordError as Error).message)
                expect((unknownEmailError as { code: string }).code).toBe((wrongPasswordError as { code: string }).code)
            })

        it("sds.login.session-store t-accept: a successful sign-in writes one active session",
            async () => {
                const result = await handler.execute(new SignInCommand({
                    email: "person@example.com", password: "correct-horse" 
                }))
                const session = await sessionService.findActive(result.sessionToken)
                expect(session.personId).toBe(result.personId)
            })

        it("event.login.signed-in: publishes on the PlatformEventBus after a successful sign-in",
            async () => {
                const received: Array<unknown> = []
                events.subscribe(event => received.push(event))

                const result = await handler.execute(new SignInCommand({
                    email: "person@example.com", password: "correct-horse" 
                }))

                expect(received).toHaveLength(1)
                const [published] = received as [SignedInEvent]
                expect(published).toBeInstanceOf(SignedInEvent)
                expect(published.personId).toBe(result.personId)
            })

        it("a refused sign-in publishes nothing",
            async () => {
                const received: Array<unknown> = []
                events.subscribe(event => received.push(event))

                await expect(handler.execute(new SignInCommand({
                    email: "person@example.com", password: "wrong" 
                }))).rejects.toMatchObject({
                    code: "INVALID_CREDENTIALS_EXCEPTION",
                })
                expect(received).toHaveLength(0)
            })
    })
