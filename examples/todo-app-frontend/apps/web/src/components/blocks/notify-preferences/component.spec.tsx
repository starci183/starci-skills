import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { NotifyPreferencesView, NOTIFY_PREFERENCES_STATES, type NotifyPreferencesViewCopy, type NotifyPreferencesViewProps } from "./component"

const noop = () => {}

/** The English copy the connected half resolves for an `en` reader; the view draws what it is given. */
const copy: NotifyPreferencesViewCopy = {
    brand: "Todo app",
    accountName: "Alex",
    signOut: "Sign out",
    navLabel: "Primary",
    destinations: { tasks: "Tasks", notifications: "Notifications", plan: "Plan", privacy: "Privacy" },
    legal: { privacyPolicy: "Privacy policy", terms: "Terms" },
    backToTasks: "Back to tasks",
    breadcrumbLabel: "Breadcrumb",
    mainLabel: "The notification preferences screen",
    breadcrumb: "Settings / Notifications",
    heading: "Notification preferences",
    tagline: "Choose whether to receive task updates by email.",
    digestHeading: "Email digest",
    digestTagline: "Receive grouped task updates in your inbox.",
    on: "On",
    off: "Off",
    turnOn: "Turn on",
    turnOff: "Turn off",
    unsubscribedNote: "You are unsubscribed from the email digest.",
    save: "Save preferences",
    saving: "Saving…",
    unsubscribe: "Unsubscribe from email",
    unsubscribeHint: "You can also unsubscribe using the link in any email.",
}

const renderView = (overrides: Partial<NotifyPreferencesViewProps> = {}) =>
    render(
        <NotifyPreferencesView
            state="subscribed"
            subscribed
            refusal={null}
            pending={null}
            copy={copy}
            onToggle={noop}
            onSave={noop}
            onUnsubscribe={noop}
            onSignOut={noop}
            {...overrides}
        />,
    )

describe("NotifyPreferencesView", () => {
    it("ui.notify.preferences: loading rests the toggle as a skeleton, disables save, shows no message", () => {
        const { container } = renderView({ state: "loading", subscribed: null })
        expect(container.querySelector("[data-state=\"loading\"]")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Save preferences" })).toBeDisabled()
        expect(screen.queryByText(/couldn't save/)).toBeNull()
        expect(screen.queryByText(/unsubscribed from the email digest/)).toBeNull()
    })

    it("ui.notify.preferences: subscribed shows the on toggle and an available save", () => {
        renderView({ state: "subscribed", subscribed: true })
        expect(screen.getByText("On")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Turn off" })).toBeEnabled()
        expect(screen.getByRole("button", { name: "Save preferences" })).toBeEnabled()
    })

    it("ui.notify.preferences: unsubscribed shows the off toggle and a non-danger confirmation", () => {
        renderView({ state: "unsubscribed", subscribed: false })
        expect(screen.getByText("Off")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Turn on" })).toBeEnabled()
        expect(screen.getByText("You are unsubscribed from the email digest.")).toBeInTheDocument()
    })

    it("ui.notify.preferences: saving disables the save action and shows its busy label", () => {
        renderView({ state: "saving", subscribed: true, pending: "save" })
        expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "Turn off" })).toBeDisabled()
    })

    it("ui.notify.preferences: refused announces the refusal and keeps the pre-save value", () => {
        const refusal = "We couldn't save your preference. Try again."
        renderView({ state: "refused", subscribed: true, refusal })
        expect(screen.getByText(refusal)).toBeInTheDocument()
        expect(screen.getByText("On")).toBeInTheDocument()
    })

    it("ui.notify.preferences: every state in the closed vocabulary renders its own data-state", () => {
        for (const state of NOTIFY_PREFERENCES_STATES) {
            const { container, unmount } = renderView({ state, subscribed: true, refusal: "refused" })
            expect(container.querySelector(`[data-state="${state}"]`)).not.toBeNull()
            unmount()
        }
    })

    it("ui.notify.preferences: the shell carries the settled furniture - brand, four destinations, Alex, footer, no mascot", () => {
        renderView()
        expect(screen.getAllByText("Todo app").length).toBeGreaterThan(0)
        for (const label of ["Tasks", "Notifications", "Plan", "Privacy"]) {
            expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0)
        }
        expect(screen.getAllByText("Alex").length).toBeGreaterThan(0)
        expect(screen.getByRole("link", { name: "Back to tasks" })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Privacy policy" })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Terms" })).toBeInTheDocument()
        expect(screen.queryByRole("img")).toBeNull()
    })
})
