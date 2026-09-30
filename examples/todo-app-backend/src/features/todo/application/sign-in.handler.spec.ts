import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { AuditAction } from "@modules/domain/audit"
import { SessionErrorCode } from "@modules/domain/session"
import type { SessionService, SessionView } from "@modules/domain/session"
import { KeycloakError, KeycloakErrorCode } from "@modules/integrations/keycloak"
import type { KeycloakClient } from "@modules/integrations/keycloak"
import type { Logger } from "@modules/platform/logging"
import type { Outbox } from "@modules/platform/outbox"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { SignInCommand } from "./sign-in.command"
import { SignInHandler } from "./sign-in.handler"

const AT = new Date("2026-09-30T10:00:00.000Z")
const session: SessionView = {
    token: "token-1",
    personId: "person-1",
    issuedAt: AT,
    expiresAt: new Date("2026-10-30T10:00:00.000Z"),
}
const command = (email = "person@example.com", password = "correct-horse"): SignInCommand =>
    new SignInCommand({ request: { email, password } })

const build = (
    signIn: jest.Mock = jest.fn().mockResolvedValue({ subject: "person-1" }),
): {
    handler: SignInHandler
    keycloak: KeycloakClient
    sessions: SessionService
    outbox: Outbox
    inner: ReturnType<typeof mockEntityManager>
} => {
    const inner = mockEntityManager()
    const keycloak = mock<KeycloakClient>({ signIn })
    const sessions = mock<SessionService>({ open: jest.fn().mockResolvedValue(session) })
    const outbox = mock<Outbox>()
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    const handler = new SignInHandler(mock<Logger>(), entityManager, new FakeClock(AT), outbox, keycloak, sessions)
    return { handler, keycloak, sessions, outbox, inner }
}

describe("SignInHandler", () => {
    it("opens the session and writes the sign-in audit message in the same transaction when the provider accepts the pair", async () => {
        const { handler, keycloak, sessions, outbox, inner } = build()
        const result = await handler.execute(command())
        expect(result).toEqual({ kind: "ok", value: { sessionToken: "token-1", personId: "person-1" } })
        expect(keycloak.signIn).toHaveBeenCalledWith({ email: "person@example.com", password: "correct-horse" })
        expect(sessions.open).toHaveBeenCalledWith({ manager: inner, personId: "person-1", at: AT })
        expect(outbox.enqueue).toHaveBeenCalledTimes(1)
        expect(outbox.enqueue).toHaveBeenCalledWith(
            inner,
            expect.objectContaining({
                payload: expect.objectContaining({ actorId: "person-1", action: AuditAction.SignedIn, target: null }),
            }),
        )
    })

    it("calls the provider before the transaction is opened", async () => {
        const order: Array<string> = []
        const signIn = jest.fn().mockImplementation(() => {
            order.push("provider")
            return Promise.resolve({ subject: "person-1" })
        })
        const { handler, sessions } = build(signIn)
        jest.mocked(sessions.open).mockImplementation(() => {
            order.push("transaction")
            return Promise.resolve(session)
        })
        await handler.execute(command())
        expect(order).toEqual(["provider", "transaction"])
    })

    it("refuses a wrong pair and an unknown email with the same code and opens no session", async () => {
        const refusal = jest.fn().mockRejectedValue(new KeycloakError({ code: KeycloakErrorCode.InvalidCredentials }))
        const { handler, sessions, outbox } = build(refusal)
        const wrongPassword = await handler.execute(command("person@example.com", "wrong"))
        const unknownEmail = await handler.execute(command("nobody@example.com", "anything"))
        expect(wrongPassword).toEqual({ kind: "refused", code: SessionErrorCode.InvalidCredentials })
        expect(unknownEmail).toEqual(wrongPassword)
        expect(sessions.open).not.toHaveBeenCalled()
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })

    it("refuses an email that is not shaped like one without calling the provider", async () => {
        const { handler, keycloak } = build()
        const result = await handler.execute(command("not-an-email"))
        expect(result).toMatchObject({ kind: "refused", code: SessionErrorCode.InvalidCredentials })
        expect(keycloak.signIn).not.toHaveBeenCalled()
    })

    it("tells an outage of the provider apart from bad credentials and opens no session", async () => {
        const outage = jest.fn().mockRejectedValue(new KeycloakError({ code: KeycloakErrorCode.ProviderUnavailable }))
        const { handler, sessions, outbox } = build(outage)
        const result = await handler.execute(command())
        expect(result).toMatchObject({ kind: "refused", code: SessionErrorCode.ProviderUnavailable })
        expect(sessions.open).not.toHaveBeenCalled()
        expect(outbox.enqueue).not.toHaveBeenCalled()
    })

    it("lets a failure that is not a provider refusal through", async () => {
        const bug = new TypeError("bug")
        const { handler } = build(jest.fn().mockRejectedValue(bug))
        await expect(handler.execute(command())).rejects.toBe(bug)
    })
})
