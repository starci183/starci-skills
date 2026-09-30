import { toNotificationPreferencesRequest, toNotificationPreferencesType } from "./notification-preferences.mapper"

describe("notification-preferences mapper", () => {
    it("maps the channel of the input and defaults an omitted input or channel to email", () => {
        expect(toNotificationPreferencesRequest({ channel: "push" })).toEqual({ channel: "push" })
        expect(toNotificationPreferencesRequest({})).toEqual({ channel: "email" })
        expect(toNotificationPreferencesRequest(undefined)).toEqual({ channel: "email" })
    })

    it("maps the stored preferences to the type", () => {
        expect(
            toNotificationPreferencesType({ channel: "email", unsubscribed: true, digestWindowMinutes: 5 }),
        ).toEqual({ channel: "email", unsubscribed: true, digestWindowMinutes: 5 })
        expect(
            toNotificationPreferencesType({ channel: "email", unsubscribed: false, digestWindowMinutes: null }),
        ).toEqual({ channel: "email", unsubscribed: false, digestWindowMinutes: null })
    })
})
