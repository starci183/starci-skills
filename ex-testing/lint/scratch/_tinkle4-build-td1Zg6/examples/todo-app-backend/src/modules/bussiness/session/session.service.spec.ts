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
    POSTGRESQL_PRIMARY 
} from "@modules/platform/databases/postgresql/primary/constants/connection"
import {
    SessionEntity 
} from "@modules/platform/databases/postgresql/primary/entities/session.entity"
import {
    createFakeEntityManager 
} from "@modules/platform/databases/postgresql/primary/testing/fake-entity-manager"
import {
    SessionService 
} from "./session.service"

describe("SessionService",
    () => {
        let moduleRef: TestingModule
        let service: SessionService

        beforeEach(async () => {
            moduleRef = await Test.createTestingModule({
                providers: [
                    SessionService,
                    AppConfigService,
                    {
                        provide: getEntityManagerToken(POSTGRESQL_PRIMARY),
                        useValue: createFakeEntityManager<SessionEntity>("token"),
                    },
                ],
            }).compile()
            service = moduleRef.get(SessionService)
        })

        afterEach(async () => {
            await moduleRef.close()
        })

        it("t-begin: a malformed email is refused before any write, and a well-formed one passes through",
            () => {
                expect(() => service.tBegin("not-an-email")).toThrow(expect.objectContaining({
                    code: "INVALID_CREDENTIALS_EXCEPTION" 
                }))
                expect(() => service.tBegin("person@example.com")).not.toThrow()
            })

        it("sds.login.session-store: expiry is enforced on read, and the row is deleted on the way out",
            async () => {
                const session = await service.tAccept("person-1")
                jest.spyOn(Date,
                    "now").mockReturnValue(session.expiresAt.getTime() + 1)

                await expect(service.findActive(session.token)).rejects.toMatchObject({
                    code: "SESSION_EXPIRED_EXCEPTION" 
                })
                await expect(service.findActive(session.token)).rejects.toMatchObject({
                    code: "SESSION_NOT_FOUND_EXCEPTION" 
                })

                jest.spyOn(Date,
                    "now").mockRestore()
            })

        it("ac.login.session.restores.returning-within-the-window-stays-signed-in: a session within the window is still active",
            async () => {
                const session = await service.tAccept("person-1")

                const active = await service.findActive(session.token)

                expect(active.personId).toBe("person-1")
            })

        it("t-revoke: the row is deleted so the next read of that token finds nothing",
            async () => {
                const session = await service.tAccept("person-1")

                await service.tRevoke(session.token)

                await expect(service.findActive(session.token)).rejects.toMatchObject({
                    code: "SESSION_NOT_FOUND_EXCEPTION" 
                })
            })

        it("sds.login.session-store t-accept: a successful sign-in writes one session row with a thirty-day expiry",
            async () => {
                const session = await service.tAccept("person-1")
                const days = Math.round((session.expiresAt.getTime() - session.issuedAt.getTime()) / (24 * 60 * 60 * 1000))
                expect(days).toBe(30)
            })

        it("an operation without a session token is refused before any database read",
            async () => {
                const entityManager = createFakeEntityManager<SessionEntity>("token")
                const findOneBySpy = jest.spyOn(entityManager,
                    "findOneBy")
                const isolated = await Test.createTestingModule({
                    providers: [
                        SessionService,
                        AppConfigService,
                        {
                            provide: getEntityManagerToken(POSTGRESQL_PRIMARY), useValue: entityManager 
                        },
                    ],
                }).compile()
                const isolatedService = isolated.get(SessionService)
                try {
                    await isolatedService.tAccept("person-1") // a real session exists, so a bypass would have something to match.

                    await expect(isolatedService.findActive("")).rejects.toMatchObject({
                        code: "SESSION_NOT_FOUND_EXCEPTION" 
                    })
                    await expect(isolatedService.findActive(undefined as unknown as string)).rejects.toMatchObject({
                        code: "SESSION_NOT_FOUND_EXCEPTION" 
                    })

                    expect(findOneBySpy).not.toHaveBeenCalled()
                } finally {
                    await isolated.close()
                }
            })
    })
