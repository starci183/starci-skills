import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import { NotifyError, NotifyErrorCode } from "@modules/domain/notify"
import type { Principal } from "@modules/platform/cqrs"
import { UpdateNotificationPreferencesCommand } from "../../application/update-notification-preferences.command"
import { UpdateNotificationPreferencesResolver } from "./update-notification-preferences.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("UpdateNotificationPreferencesResolver", () => {
    it("dispatches one update command for the caller and answers the stored preferences", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest
                .fn()
                .mockResolvedValue({ kind: "ok", value: { channel: "email", unsubscribed: true, digestWindowMinutes: 5 } }),
        })
        const result = await new UpdateNotificationPreferencesResolver(commandBus).updateNotificationPreferences(
            principal,
            { channel: "email", unsubscribed: true, digestWindowMinutes: 5 },
        )
        expect(result).toEqual({ channel: "email", unsubscribed: true, digestWindowMinutes: 5 })
        expect(commandBus.execute).toHaveBeenCalledWith(
            new UpdateNotificationPreferencesCommand({
                request: { channel: "email", unsubscribed: true, digestWindowMinutes: 5 },
                principal,
            }),
        )
    })

    it("turns a refusal into the notify error", async () => {
        const commandBus = mock<CommandBus>({
            execute: jest.fn().mockResolvedValue({ kind: "refused", code: NotifyErrorCode.DigestWindowInvalid }),
        })
        const resolver = new UpdateNotificationPreferencesResolver(commandBus)
        await expect(
            resolver.updateNotificationPreferences(principal, { channel: "email", digestWindowMinutes: 0 }),
        ).rejects.toBeInstanceOf(NotifyError)
    })
})
