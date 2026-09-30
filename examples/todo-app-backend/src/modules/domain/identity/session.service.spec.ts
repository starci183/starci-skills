import { Test } from "@nestjs/testing"
import type { MockEntityManager } from "@starci/jest-preset"
import { FakeClock, fakeIds, fakeTransaction, mock, mockEntityManager, recordingOutbox } from "@starci/jest-preset"
import { AuditAction } from "@modules/domain/audit"
import { KEYCLOAK, KeycloakError, KeycloakErrorCode, KeycloakLogEvent } from "@modules/integrations/keycloak"
import type { KeycloakClient } from "@modules/integrations/keycloak"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OUTBOX } from "@modules/platform/outbox"
import {
    IDENTITY_NOW,
    findSessionInput,
    lapsedSessionRow,
    purgeSessionsInput,
    sessionRow,
    signInInput,
    signOutInput,
} from "@tests/fixtures/builders/identity.builder"
import { IdentityErrorCode } from "./errors/identity.error"
import { IDENTITY_OPTIONS } from "./identity.decorators"
import { SessionEntity } from "./persistence/entities/session.entity"
import { PURGE_LAPSED_SESSIONS } from "./persistence/session.sql"
import { SessionService } from "./session.service"

const NOW = IDENTITY_NOW
const AT = new Date(NOW)
const OPTIONS = { ttlDays: 2, adminSubjects: ["boss"] }

const LIVE = sessionRow()
const LAPSED = lapsedSessionRow()

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const transaction = fakeTransaction(entityManager)
    const clock = new FakeClock(NOW)
    const outbox = recordingOutbox()
    const keycloak = mock<KeycloakClient>()
    const logger = mock<Logger>()
    const ids = fakeIds()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SessionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: transaction.em },
            { provide: IDENTITY_OPTIONS, useValue: OPTIONS },
            { provide: CLOCK, useValue: clock },
            { provide: IDS, useValue: ids },
            { provide: OUTBOX, useValue: outbox },
            { provide: KEYCLOAK, useValue: keycloak },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(SessionService), transaction, outbox, keycloak, logger }
}

describe("SessionService", () => {
    describe("signIn", () => {
        it("refuses an implausible email without calling the provider or the database", async () => {
            const { service, keycloak, transaction, outbox } = await build()

            await expect(service.signIn(signInInput({ email: "not-an-email" }))).resolves.toBeRefused(
                IdentityErrorCode.InvalidCredentials,
            )

            expect(keycloak.signIn).not.toHaveBeenCalled()
            expect(transaction.outcomes).toEqual([])
            expect(outbox.messages).toEqual([])
        })

        it("refuses with the uniform credentials code when the provider rejects the pair", async () => {
            const { service, keycloak, transaction } = await build()
            keycloak.signIn.mockRejectedValue(new KeycloakError({ code: KeycloakErrorCode.InvalidCredentials }))

            await expect(service.signIn(signInInput())).resolves.toBeRefused(
                IdentityErrorCode.InvalidCredentials,
            )

            expect(transaction.outcomes).toEqual([])
        })

        it("refuses as unavailable when the provider cannot be reached", async () => {
            const { service, keycloak, transaction } = await build()
            keycloak.signIn.mockRejectedValue(new KeycloakError({ code: KeycloakErrorCode.ProviderUnavailable }))

            await expect(service.signIn(signInInput())).resolves.toBeRefused(
                IdentityErrorCode.ProviderUnavailable,
            )

            expect(transaction.outcomes).toEqual([])
        })

        it("rethrows a failure that is not a provider refusal and opens no session", async () => {
            const { service, keycloak, transaction } = await build()
            const failure = new Error("boom")
            keycloak.signIn.mockRejectedValue(failure)

            await expect(service.signIn(signInInput())).rejects.toBe(failure)

            expect(transaction.outcomes).toEqual([])
        })

        it("opens the session and writes the audit line in one committed transaction", async () => {
            const { service, keycloak, transaction, outbox } = await build(mockEntityManager({ save: [SessionEntity, LIVE] }))
            keycloak.signIn.mockResolvedValue({ subject: "p1" })

            await expect(service.signIn(signInInput())).resolves.toSucceedWith({
                sessionToken: "t1",
                personId: "p1",
            })

            expect(keycloak.signIn).toHaveBeenCalledWith(signInInput())
            expect(transaction.outcomes).toEqual(["commit"])
            expect(transaction.committedWrites).toEqual([
                {
                    method: "save",
                    args: [
                        SessionEntity,
                        {
                            token: "00000000-0000-4000-8000-000000000001",
                            personId: "p1",
                            issuedAt: AT,
                            expiresAt: new Date("2026-10-02T10:00:00.000Z"),
                        },
                    ],
                },
            ])
            expect(outbox.allInTransaction).toBe(true)
            expect(outbox.messages).toEqual([
                {
                    queue: "audit.append",
                    eventId: "00000000-0000-4000-8000-000000000002",
                    payload: { actorId: "p1", action: AuditAction.SignedIn, target: null, at: NOW },
                    availableAt: AT,
                },
            ])
        })
    })

    describe("signOut", () => {
        it("refuses an empty token before it queries anything", async () => {
            const { service, keycloak, transaction, outbox } = await build()

            const outcome = await service.signOut(signOutInput({ sessionToken: "" }))

            expect(outcome).toBeRefused({ code: IdentityErrorCode.NotFound, params: { reason: "missing-token" } })
            expect(transaction.outcomes).toEqual([])
            expect(outbox.messages).toEqual([])
            expect(keycloak.notifySignOut).not.toHaveBeenCalled()
        })

        it("refuses an unknown token and changes nothing", async () => {
            const { service, keycloak, transaction, outbox } = await build(mockEntityManager({ findOneBy: [SessionEntity, null] }))

            await expect(service.signOut(signOutInput())).resolves.toBeRefused(IdentityErrorCode.NotFound)

            expect(transaction.outcomes).toEqual([])
            expect(outbox.messages).toEqual([])
            expect(keycloak.notifySignOut).not.toHaveBeenCalled()
        })

        it("refuses a lapsed session as expired and changes nothing", async () => {
            const { service, keycloak, transaction } = await build(mockEntityManager({ findOneBy: [SessionEntity, LAPSED] }))

            await expect(service.signOut(signOutInput())).resolves.toBeRefused(IdentityErrorCode.Expired)

            expect(transaction.outcomes).toEqual([])
            expect(keycloak.notifySignOut).not.toHaveBeenCalled()
        })

        it("revokes the session with its audit line in one transaction, then tells the provider", async () => {
            const { service, keycloak, transaction, outbox, logger } = await build(mockEntityManager({
                findOneBy: [SessionEntity, LIVE],
                delete: [SessionEntity, { affected: 1 }],
            }))
            keycloak.notifySignOut.mockResolvedValue()

            await expect(service.signOut(signOutInput())).resolves.toSucceedWith({ signedOut: true })

            expect(transaction.outcomes).toEqual(["commit"])
            expect(transaction.committedWrites).toEqual([{ method: "delete", args: [SessionEntity, "t1"] }])
            expect(outbox.allInTransaction).toBe(true)
            expect(outbox.messages).toEqual([
                {
                    queue: "audit.append",
                    eventId: "00000000-0000-4000-8000-000000000001",
                    payload: { actorId: "p1", action: AuditAction.SignedOut, target: null, at: NOW },
                    availableAt: AT,
                },
            ])
            expect(keycloak.notifySignOut).toHaveBeenCalledWith({ personId: "p1" })
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("logs a failed provider notice and still signs out", async () => {
            const { service, keycloak, transaction, logger } = await build(mockEntityManager({
                findOneBy: [SessionEntity, LIVE],
                delete: [SessionEntity, { affected: 1 }],
            }))
            const failure = new Error("provider down")
            keycloak.notifySignOut.mockRejectedValue(failure)

            await expect(service.signOut(signOutInput())).resolves.toSucceedWith({ signedOut: true })

            expect(transaction.outcomes).toEqual(["commit"])
            expect(logger.error).toHaveBeenCalledWith(KeycloakLogEvent.SignOutNotifyFailed, failure)
        })
    })

    describe("find", () => {
        it("answers the view of a live session", async () => {
            const { service } = await build(mockEntityManager({ findOneBy: [SessionEntity, LIVE] }))

            await expect(service.find(findSessionInput())).resolves.toSucceedWith({
                token: "t1",
                personId: "p1",
                issuedAt: new Date("2026-09-29T10:00:00.000Z"),
                expiresAt: new Date("2026-10-01T10:00:00.000Z"),
            })
        })
    })

    describe("purgeLapsed", () => {
        it("deletes the lapsed sessions in one transaction and answers how many went", async () => {
            const { service, transaction } = await build(mockEntityManager({
                query: [PURGE_LAPSED_SESSIONS, [[{ token: "a" }, { token: "b" }], 2]],
            }))

            await expect(service.purgeLapsed(purgeSessionsInput())).resolves.toEqual({ purged: 2 })

            expect(transaction.outcomes).toEqual(["commit"])
            expect(transaction.em.query).toHaveBeenCalledWith(PURGE_LAPSED_SESSIONS, [AT])
        })
    })

    describe("principalOf", () => {
        it("gives an administrator the admin role and everyone else only member", async () => {
            const { service } = await build()

            expect(service.principalOf("boss")).toEqual({ id: "boss", roles: ["member", "admin"] })
            expect(service.principalOf("p1")).toEqual({ id: "p1", roles: ["member"] })
        })
    })
})
