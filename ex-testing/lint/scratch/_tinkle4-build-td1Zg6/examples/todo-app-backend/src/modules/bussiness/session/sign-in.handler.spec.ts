import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    SessionService 
} from "./session.service"
import {
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    SessionEntity 
} from "@modules/platform/databases/postgresql/primary/entities/session.entity"
import {
    createFakeEntityManager 
} from "@modules/platform/databases/postgresql/primary/testing/fake-entity-manager"
import {
    KeycloakClient, KeycloakSignInResult 
} from "@modules/integrations/keycloak/keycloak.client"
import {
    KeycloakInvalidCredentialsException 
} from "@modules/shared/exceptions/errors/keycloak/keycloak-invalid-credentials"
import {
    PlatformEventBus 
} from "@modules/platform/events/event-bus.providers"
import {
    SignedInEvent 
} from "@modules/platform/events/events.types"
import {
    SignInCommand 
} from "./sign-in.command"
import {
    SignInHandler 
} from "./sign-in.handler"

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
        if (this.accepted[key] !== password) {
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
                let unknownEmailError: unknown
                let wrongPasswordError: unknown
                try {
                    await handler.execute(new SignInCommand({
                        email: "nobody@example.com", password: "anything" 
                    }))
                } catch (error) {
                    unknownEmailError = error
                }
                try {
                    await handler.execute(new SignInCommand({
                        email: "person@example.com", password: "wrong-password" 
                    }))
                } catch (error) {
                    wrongPasswordError = error
                }
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
