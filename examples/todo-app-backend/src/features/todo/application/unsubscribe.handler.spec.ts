import { mock } from "@starci/jest-preset/mock"
import { NotifyErrorCode } from "@modules/domain/notify"
import type { PreferencesService } from "@modules/domain/notify"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { fakeTransaction, mockEntityManager } from "@tests/fixtures/database"
import { UnsubscribeCommand } from "./unsubscribe.command"
import { UnsubscribeHandler } from "./unsubscribe.handler"

const principal: Principal = { id: "owner-1", roles: ["member"] }

const build = (outcome: unknown) => {
    const inner = mockEntityManager()
    const preferences = mock<PreferencesService>({ update: jest.fn().mockResolvedValue(outcome) })
    const entityManager = mockEntityManager({ transaction: fakeTransaction(inner) })
    return { handler: new UnsubscribeHandler(mock<Logger>(), entityManager, preferences), preferences, inner }
}

describe("UnsubscribeHandler", () => {
    it("sets only the opt-out flag of the caller on the requested channel", async () => {
        const { handler, preferences, inner } = build({
            kind: "ok",
            value: { personId: "owner-1", channel: "push", unsubscribed: true, digestWindowMinutes: 5 },
        })
        const result = await handler.execute(new UnsubscribeCommand({ request: { channel: "push" }, principal }))
        expect(result).toEqual({ kind: "ok", value: { channel: "push", unsubscribed: true } })
        expect(preferences.update).toHaveBeenCalledWith({
            manager: inner,
            personId: "owner-1",
            channel: "push",
            patch: { unsubscribed: true },
        })
    })

    it("returns the refusal of a blank channel as it is", async () => {
        const refusal = { kind: "refused", code: NotifyErrorCode.ChannelRequired }
        const { handler } = build(refusal)
        const result = await handler.execute(new UnsubscribeCommand({ request: { channel: " " }, principal }))
        expect(result).toEqual(refusal)
    })
})
