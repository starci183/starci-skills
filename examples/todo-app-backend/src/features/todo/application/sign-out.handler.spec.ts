import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { AuditAction } from "@modules/domain/audit"
import { SessionErrorCode } from "@modules/domain/session"
import type { SessionService, SessionView } from "@modules/domain/session"
import { KeycloakLogEvent } from "@modules/integrations/keycloak"
import type { KeycloakClient } from "@modules/integrations/keycloak"
import type { Logger } from "@modules/platform/logging"
import type { Outbox } from "@modules/platform/outbox"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { SignOutCommand } from "./sign-out.command"
import { SignOutHandler } from "./sign-out.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const session: SessionView = {
    token: "token-1",
    personId: "person-1",
    issuedAt: new Date("2026-09-29T10:00:00.000Z"),
    expiresAt: new Date("2026-10-30T10:00:00.000Z"),
}
const command = new SignOutCommand({ request: { sessionToken: "token-1" } })

const build = (
    parts: { found?: unknown; notify?: jest.Mock } = {},
): {
    handler: SignOutHandler
    sessions: SessionService
    keycloak: KeycloakClient
    outbox: Outbox
    logger: Logger
    inner: ReturnType<typeof mockEntityManager>
} => {
    const inner = mockEntityManager()
    const logger = mock<Logger>()
    const sessions = mock<SessionService>({
        find: jest.fn().mockResolvedValue(parts.found ?? { kind: "ok", value: session }),
        revoke: jest.fn().mockResolvedValue(undefined),
    })
    const keycloak = mock<KeycloakClient>({ notifySignOut: parts.notify ?? jest.fn().mockResolvedValue(undefined) })
    const outbox = mock<Outbox>()
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    const handler = new SignOutHandler(logger, entityManager, new FakeClock(AT), outbox, keycloak, sessions)
    return { handler, sessions, keycloak, outbox, logger, inner }
}

describe("SignOutHandler", () => {
    it("revokes the session with the sign-out audit message in one transaction, then tells the provider", async () => {
        const { handler, sessions, keycloak, outbox, inner } = build()
        const result = await handler.execute(command)
        expect(result).toEqual({ kind: "ok", value: { signedOut: true } })
        expect(sessions.find).toHaveBeenCalledWith({ token: "token-1", at: AT })
        expect(sessions.revoke).toHaveBeenCalledWith({ manager: inner, token: "token-1" })
        expect(outbox.enqueue).toHaveBeenCalledWith(
            inner,
            expect.objectContaining({
                payload: expect.objectContaining({ actorId: "person-1", action: AuditAction.SignedOut, target: null }),
            }),
        )
        expect(keycloak.notifySignOut).toHaveBeenCalledWith({ personId: "person-1" })
    })

    it("tells the provider only after the transaction, never inside it", async () => {
        const order: Array<string> = []
        const notify = jest.fn().mockImplementation(() => {
            order.push("notify")
            return Promise.resolve()
        })
        const { handler, sessions } = build({ notify })
        jest.mocked(sessions.revoke).mockImplementation(() => {
            order.push("revoke")
            return Promise.resolve()
        })
        await handler.execute(command)
        expect(order).toEqual(["revoke", "notify"])
    })

    it("logs the failure and still signs out when the notice to the provider fails", async () => {
        const failure = new Error("keycloak down")
        const { handler, logger, sessions } = build({ notify: jest.fn().mockRejectedValue(failure) })
        const result = await handler.execute(command)
        expect(result).toEqual({ kind: "ok", value: { signedOut: true } })
        expect(sessions.revoke).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(KeycloakLogEvent.SignOutNotifyFailed, failure)
    })

    it("refuses a token that names no live session and revokes, audits and notifies nothing", async () => {
        for (const code of [SessionErrorCode.NotFound, SessionErrorCode.Expired]) {
            const { handler, sessions, keycloak, outbox } = build({ found: { kind: "refused", code } })
            const result = await handler.execute(command)
            expect(result).toEqual({ kind: "refused", code })
            expect(sessions.revoke).not.toHaveBeenCalled()
            expect(outbox.enqueue).not.toHaveBeenCalled()
            expect(keycloak.notifySignOut).not.toHaveBeenCalled()
        }
    })
})
