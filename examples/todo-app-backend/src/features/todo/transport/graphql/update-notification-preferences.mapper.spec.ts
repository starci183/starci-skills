import {
    toUpdateNotificationPreferencesRequest,
    toUpdateNotificationPreferencesType,
} from "./update-notification-preferences.mapper"

describe("update-notification-preferences mapper", () => {
    it("maps every field of the input and leaves an omitted one omitted", () => {
        expect(
            toUpdateNotificationPreferencesRequest({ channel: "email", unsubscribed: true, digestWindowMinutes: 5 }),
        ).toEqual({ channel: "email", unsubscribed: true, digestWindowMinutes: 5 })
        expect(toUpdateNotificationPreferencesRequest({ channel: "email" })).toEqual({
            channel: "email",
            unsubscribed: undefined,
            digestWindowMinutes: undefined,
        })
    })

    it("maps the stored preferences to the type", () => {
        expect(
            toUpdateNotificationPreferencesType({ channel: "email", unsubscribed: true, digestWindowMinutes: null }),
        ).toEqual({ channel: "email", unsubscribed: true, digestWindowMinutes: null })
    })
})
