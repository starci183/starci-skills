import { mock } from "@starci/jest-preset/mock"
import type { PreferencesService } from "@modules/domain/notify"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { NotificationPreferencesHandler } from "./notification-preferences.handler"
import { NotificationPreferencesQuery } from "./notification-preferences.query"

const principal: Principal = { id: "owner-1", roles: ["member"] }

describe("NotificationPreferencesHandler", () => {
    it("reads the preferences of the caller, never of anyone else", async () => {
        const preferences = mock<PreferencesService>({
            get: jest
                .fn()
                .mockResolvedValue({ personId: "owner-1", channel: "email", unsubscribed: true, digestWindowMinutes: 5 }),
        })
        const handler = new NotificationPreferencesHandler(mock<Logger>(), preferences)
        const result = await handler.execute(new NotificationPreferencesQuery({ request: { channel: "email" }, principal }))
        expect(result).toEqual({ channel: "email", unsubscribed: true, digestWindowMinutes: 5 })
        expect(preferences.get).toHaveBeenCalledWith({ personId: "owner-1", channel: "email" })
    })

    it("reads back the defaults when no preference was ever written", async () => {
        const preferences = mock<PreferencesService>({
            get: jest
                .fn()
                .mockResolvedValue({ personId: "owner-1", channel: "email", unsubscribed: false, digestWindowMinutes: null }),
        })
        const handler = new NotificationPreferencesHandler(mock<Logger>(), preferences)
        const result = await handler.execute(new NotificationPreferencesQuery({ request: { channel: "email" }, principal }))
        expect(result).toEqual({ channel: "email", unsubscribed: false, digestWindowMinutes: null })
    })
})
