import { describe, expect, it, vi, beforeEach } from "vitest"
import * as graphqlModule from "@/modules/api"
import { readNotificationPreferences, unsubscribeFromEmail, updateNotificationPreferences } from "./api"

vi.mock("@/modules/api", async () => {
    const actual = await vi.importActual<typeof graphqlModule>("@/modules/api")
    return { ...actual, graphql: vi.fn() }
})

const mockedGraphql = () => graphqlModule.graphql as unknown as ReturnType<typeof vi.fn>

describe("notify api", () => {
    beforeEach(() => mockedGraphql().mockReset())

    it("readNotificationPreferences returns the caller's email-channel preferences", async () => {
        const saved = { channel: "email", unsubscribed: false, digestWindowMinutes: 15 }
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: saved })

        await expect(readNotificationPreferences("tok-1")).resolves.toEqual(saved)
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("notificationPreferences"), undefined, "tok-1")
    })

    it("updateNotificationPreferences persists the toggle on the email channel", async () => {
        const saved = { channel: "email", unsubscribed: true, digestWindowMinutes: null }
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: saved })

        await expect(updateNotificationPreferences("tok-1", true)).resolves.toEqual(saved)
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("updateNotificationPreferences"), { input: { channel: "email", unsubscribed: true } }, "tok-1")
    })

    it("unsubscribeFromEmail answers with the stopped channel and no digest window", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: { channel: "email", unsubscribed: true } })

        await expect(unsubscribeFromEmail("tok-1")).resolves.toEqual({ channel: "email", unsubscribed: true, digestWindowMinutes: null })
    })

    it("throws when the transport refuses (an expired or missing session)", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: false, reason: "The session is not active.", code: "SESSION_NOT_FOUND" })

        await expect(readNotificationPreferences("tok-1")).rejects.toThrow("The session is not active.")
    })
})
