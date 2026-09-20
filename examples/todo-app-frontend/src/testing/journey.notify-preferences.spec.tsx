import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { NotifyPreferencesPage } from "@/components/pages/NotifyPreferencesPage"
import { renderJourney, resetJourneyWorld, seedSession, serveGraphQL, type Wire, type WireReply, type WireRoute } from "@/testing/journey"

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))

/** The preference row the backend's `notificationPreferences` query answers with. */
const PREFERENCES = { channel: "email", unsubscribed: false, digestWindowMinutes: 60 }

/** A signed-in reader whose preferences read answers with the persisted row. The fixture keeps the
 * one field the writes change because the screen re-reads after saving - a static answer would
 * settle the screen back on the pre-save value a real backend no longer holds. */
const preferencesWorld = (overrides: Readonly<Record<string, WireRoute>> = {}): Wire => {
    seedSession("tok-notify")
    let unsubscribed = PREFERENCES.unsubscribed
    return serveGraphQL({
        notificationPreferences: () => ({ data: { ...PREFERENCES, unsubscribed } }),
        updateNotificationPreferences: (variables) => {
            unsubscribed = (variables.input as { unsubscribed: boolean }).unsubscribed
            return { data: { channel: "email", unsubscribed, digestWindowMinutes: 60 } }
        },
        unsubscribe: () => {
            unsubscribed = true
            return { data: { channel: "email", unsubscribed: true } }
        },
        signOut: { data: { signedOut: true } },
        ...overrides,
    })
}

/**
 * The journey `notify/uat/digest-and-unsubscribe` walks on this screen: a signed-in owner reads
 * the email digest preference, edits it, saves, and can silence the digest entirely from the same
 * place. Mounted at the route's own page half, so the connected block, the SWR read, the notify
 * transport and the GraphQL fetcher run in the order a reader's browser runs them.
 */
describe("ui.notify.preferences journey: the served preferences screen over the real transport", () => {
    afterEach(() => {
        resetJourneyWorld()
        mocks.push.mockReset()
    })

    it("loads the saved preference with the reader's own session before it offers a write", async () => {
        const wire = preferencesWorld()
        renderJourney(<NotifyPreferencesPage />)

        // The loading frame holds every write control until the read settles.
        expect(screen.getByRole("button", { name: "Turn off" })).toBeDisabled()
        await waitFor(() => expect(screen.getByRole("button", { name: "Turn off" })).toBeEnabled())
        expect(screen.getByText("On")).toBeInTheDocument()

        const read = wire.callsFor("notificationPreferences")[0]
        expect(read.token).toBe("tok-notify")
        expect(wire.callsFor("updateNotificationPreferences")).toHaveLength(0)
    })

    it("the toggle edits a draft only - nothing is written until Save preferences is pressed", async () => {
        const wire = preferencesWorld()
        renderJourney(<NotifyPreferencesPage />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Turn off" })).toBeEnabled())

        fireEvent.click(screen.getByRole("button", { name: "Turn off" }))

        await waitFor(() => expect(screen.getByRole("button", { name: "Turn on" })).toBeInTheDocument())
        expect(screen.getByText("Off")).toBeInTheDocument()
        expect(wire.callsFor("updateNotificationPreferences")).toHaveLength(0)
    })

    it("saving persists the flipped draft under the reader's session and the screen settles on it", async () => {
        const wire = preferencesWorld()
        renderJourney(<NotifyPreferencesPage />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Turn off" })).toBeEnabled())

        fireEvent.click(screen.getByRole("button", { name: "Turn off" }))
        fireEvent.click(screen.getByRole("button", { name: "Save preferences" }))

        await waitFor(() => expect(wire.callsFor("updateNotificationPreferences")).toHaveLength(1))
        const write = wire.callsFor("updateNotificationPreferences")[0]
        expect(write.token).toBe("tok-notify")
        expect(write.variables).toEqual({ input: { channel: "email", unsubscribed: true } })
        await waitFor(() => expect(screen.getByText("Off")).toBeInTheDocument())
    })

    it("saving: the pending write holds the screen in its saving frame until the answer arrives", async () => {
        let release: (reply: WireReply) => void = () => {}
        const pending = new Promise<WireReply>(resolve => {
            release = resolve
        })
        const wire = preferencesWorld({ updateNotificationPreferences: () => pending })
        renderJourney(<NotifyPreferencesPage />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Turn off" })).toBeEnabled())

        fireEvent.click(screen.getByRole("button", { name: "Turn off" }))
        fireEvent.click(screen.getByRole("button", { name: "Save preferences" }))

        await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeInTheDocument())
        expect(screen.getByRole("button", { name: "Turn on" })).toBeDisabled()

        release({ data: { channel: "email", unsubscribed: true, digestWindowMinutes: 60 } })
        await waitFor(() => expect(screen.getByRole("button", { name: "Save preferences" })).toBeInTheDocument())
        expect(wire.callsFor("updateNotificationPreferences")).toHaveLength(1)
    })

    it("refused: a failed save names the settled sentence and the toggle drops back to the saved value", async () => {
        const wire = preferencesWorld({
            updateNotificationPreferences: { reason: "The preference write was refused.", code: "NOTIFY_SAVE_REFUSED" },
        })
        renderJourney(<NotifyPreferencesPage />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Turn off" })).toBeEnabled())

        fireEvent.click(screen.getByRole("button", { name: "Turn off" }))
        fireEvent.click(screen.getByRole("button", { name: "Save preferences" }))

        await waitFor(() => expect(screen.getByText("We couldn't save your preference. Try again.")).toBeInTheDocument())
        // The draft is dropped, so the control shows the pre-save value the record demands.
        expect(screen.getByText("On")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Turn off" })).toBeInTheDocument()
        expect(wire.callsFor("updateNotificationPreferences")).toHaveLength(1)
    })

    it("unsubscribe silences the digest from the same screen - the preference reads unsubscribed afterwards", async () => {
        const wire = preferencesWorld()
        renderJourney(<NotifyPreferencesPage />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Turn off" })).toBeEnabled())

        fireEvent.click(screen.getByRole("button", { name: "Unsubscribe from email" }))

        await waitFor(() => expect(screen.getByText("You are unsubscribed from the email digest.")).toBeInTheDocument())
        const write = wire.callsFor("unsubscribe")[0]
        expect(write.token).toBe("tok-notify")
        expect(write.variables).toEqual({ input: { channel: "email" } })
    })

    it("the digest read failing refuses the screen rather than rendering a guessed preference", async () => {
        const wire = preferencesWorld({
            notificationPreferences: { reason: "The read timed out.", code: "NOTIFY_READ_REFUSED" },
        })
        renderJourney(<NotifyPreferencesPage />)

        await waitFor(() => expect(screen.getByText("We couldn't load your preferences. Try again.")).toBeInTheDocument())
        expect(screen.getByRole("button", { name: "Save preferences" })).toBeDisabled()
        expect(wire.callsFor("notificationPreferences")).toHaveLength(1)
    })

    it("a reader with no session is asked to sign in again and the read never leaves", async () => {
        const wire = serveGraphQL({})
        renderJourney(<NotifyPreferencesPage />)

        await waitFor(() => expect(
            screen.getByText("You need to sign in again before your notification preferences can load."),
        ).toBeInTheDocument())
        expect(wire.calls).toHaveLength(0)
    })
})
