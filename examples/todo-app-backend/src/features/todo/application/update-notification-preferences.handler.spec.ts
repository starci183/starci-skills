import { mock } from "@starci/jest-preset/mock"
import { NotifyErrorCode } from "@modules/domain/notify"
import type { PreferencesService } from "@modules/domain/notify"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { UpdateNotificationPreferencesCommand } from "./update-notification-preferences.command"
import { UpdateNotificationPreferencesHandler } from "./update-notification-preferences.handler"

const principal: Principal = { id: "owner-1", roles: ["member"] }
const written = { personId: "owner-1", channel: "email", unsubscribed: true, digestWindowMinutes: 20 }

const build = (outcome: unknown) => {
    const inner = mockEntityManager()
    const preferences = mock<PreferencesService>({ update: jest.fn().mockResolvedValue(outcome) })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return {
        handler: new UpdateNotificationPreferencesHandler(mock<Logger>(), entityManager, preferences),
        preferences,
        inner,
    }
}

describe("UpdateNotificationPreferencesHandler", () => {
    it("writes the caller's own preference in one transaction and answers the stored values", async () => {
        const { handler, preferences, inner } = build({ kind: "ok", value: written })
        const result = await handler.execute(
            new UpdateNotificationPreferencesCommand({
                request: { channel: "email", unsubscribed: true, digestWindowMinutes: 20 },
                principal,
            }),
        )
        expect(result).toEqual({
            kind: "ok",
            value: { channel: "email", unsubscribed: true, digestWindowMinutes: 20 },
        })
        expect(preferences.update).toHaveBeenCalledWith({
            manager: inner,
            personId: "owner-1",
            channel: "email",
            patch: { unsubscribed: true, digestWindowMinutes: 20 },
        })
    })

    it("passes an omitted field through as omitted so the stored value is kept", async () => {
        const { handler, preferences, inner } = build({ kind: "ok", value: written })
        await handler.execute(
            new UpdateNotificationPreferencesCommand({
                request: { channel: "email", digestWindowMinutes: 20 },
                principal,
            }),
        )
        expect(preferences.update).toHaveBeenCalledWith({
            manager: inner,
            personId: "owner-1",
            channel: "email",
            patch: { unsubscribed: undefined, digestWindowMinutes: 20 },
        })
    })

    it("returns the refusal of the rule as it is", async () => {
        const refusal = { kind: "refused", code: NotifyErrorCode.DigestWindowInvalid, params: { minutes: 0 } }
        const { handler } = build(refusal)
        const result = await handler.execute(
            new UpdateNotificationPreferencesCommand({
                request: { channel: "email", digestWindowMinutes: 0 },
                principal,
            }),
        )
        expect(result).toEqual(refusal)
    })
})
