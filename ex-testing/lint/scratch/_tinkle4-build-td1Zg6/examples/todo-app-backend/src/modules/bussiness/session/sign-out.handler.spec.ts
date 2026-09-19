import {
    Test, TestingModule 
} from "@nestjs/testing"
import {
    getEntityManagerToken 
} from "@nestjs/typeorm"
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
    KeycloakClient 
} from "@modules/integrations/keycloak/keycloak.client"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    PlatformEventBus 
} from "@modules/platform/events/event-bus.providers"
import {
    SignedOutEvent 
} from "@modules/platform/events/events.types"
import {
    SignOutCommand 
} from "./sign-out.command"
import {
    SignOutHandler 
} from "./sign-out.handler"

describe("SignOutHandler",
    () => {
        let moduleRef: TestingModule
        let sessionService: SessionService
        let keycloakClient: KeycloakClient
        let events: PlatformEventBus
        let handler: SignOutHandler

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    SignOutHandler,
                    SessionService,
                    KeycloakClient,
                    AppConfigService,
                    PlatformEventBus,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<SessionEntity>("token"),
                    },
                ],
            }).compile()
            sessionService = moduleRef.get(SessionService)
            keycloakClient = moduleRef.get(KeycloakClient)
            events = moduleRef.get(PlatformEventBus)
            handler = moduleRef.get(SignOutHandler)
            jest.spyOn(keycloakClient,
                "notifySignOut").mockResolvedValue(undefined)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("br.login.session.restores: the session ends and the next request against that token is unauthenticated",
            async () => {
                const session = await sessionService.tAccept("person-1")

                const result = await handler.execute(new SignOutCommand({
                    sessionToken: session.token 
                }))

                expect(result.signedOut).toBe(true)
                await expect(sessionService.findActive(session.token)).rejects.toThrow()
            })

        it("event.login.signed-out: publishes on the PlatformEventBus after the session is revoked",
            async () => {
                const session = await sessionService.tAccept("person-1")
                const received: Array<unknown> = []
                events.subscribe(event => received.push(event))

                await handler.execute(new SignOutCommand({
                    sessionToken: session.token 
                }))

                expect(received).toHaveLength(1)
                const [published] = received as [SignedOutEvent]
                expect(published).toBeInstanceOf(SignedOutEvent)
                expect(published.personId).toBe("person-1")
            })
    })
