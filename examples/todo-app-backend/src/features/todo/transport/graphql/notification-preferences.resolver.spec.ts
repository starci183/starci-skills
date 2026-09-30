import type { QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset/mock"
import type { Principal } from "@modules/platform/cqrs"
import { NotificationPreferencesQuery } from "../../application/notification-preferences.query"
import { NotificationPreferencesResolver } from "./notification-preferences.resolver"

const principal: Principal = { id: "owner-1", roles: ["member"] }
const stored = { channel: "email", unsubscribed: false, digestWindowMinutes: null }

describe("NotificationPreferencesResolver", () => {
    it("dispatches one preferences query for the caller on the requested channel", async () => {
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue({ ...stored, channel: "push" }) })
        const result = await new NotificationPreferencesResolver(queryBus).notificationPreferences(principal, {
            channel: "push",
        })
        expect(result).toEqual({ channel: "push", unsubscribed: false, digestWindowMinutes: null })
        expect(queryBus.execute).toHaveBeenCalledWith(
            new NotificationPreferencesQuery({ request: { channel: "push" }, principal }),
        )
    })

    it("reads the email channel when no request is given", async () => {
        const queryBus = mock<QueryBus>({ execute: jest.fn().mockResolvedValue(stored) })
        await new NotificationPreferencesResolver(queryBus).notificationPreferences(principal)
        expect(queryBus.execute).toHaveBeenCalledWith(
            new NotificationPreferencesQuery({ request: { channel: "email" }, principal }),
        )
    })
})
