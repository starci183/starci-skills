import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { PrivacyView, PRIVACY_STATES, type PrivacyViewCopy, type PrivacyViewProps } from "./component"

const noop = () => {}

/** The English copy the connected half resolves for an `en` reader; the view draws what it is given. */
const copy: PrivacyViewCopy = {
    brand: "Todo app",
    accountName: "Alex",
    signOut: "Sign out",
    navLabel: "Primary",
    destinations: { tasks: "Tasks", notifications: "Notifications", plan: "Plan", privacy: "Privacy" },
    legal: { privacyPolicy: "Privacy policy", terms: "Terms" },
    backToTasks: "Back to tasks",
    breadcrumbLabel: "Breadcrumb",
    mainLabel: "The privacy screen - request erasure, export data",
    breadcrumb: "Settings / Privacy",
    heading: "Privacy and your data",
    tagline: "Manage the data linked to your account.",
    cardLabel: "Privacy",
    exportHeading: "Export your data",
    exportTagline: "Get a copy of your personal activity records.",
    exportAction: "Export my data",
    exporting: "Exporting…",
    erasureHeading: "Request erasure",
    erasureTagline: "Remove information that identifies you from the activity log. This cannot be undone once completed.",
    erasureAction: "Request erasure",
    erasureConfirm: "Confirm erasure",
    erasureCancel: "Cancel",
    erasurePending: "Submitting your erasure request…",
    erasureComplete: "Your erasure request is complete. Information that identifies you has been removed from the activity log.",
}

const renderView = (overrides: Partial<PrivacyViewProps> = {}) =>
    render(
        <PrivacyView
            state="idle"
            refusal={null}
            exportRefusal={null}
            copy={copy}
            onExport={noop}
            onRequestErasure={noop}
            onConfirmErasure={noop}
            onCancelErasure={noop}
            onSignOut={noop}
            {...overrides}
        />,
    )

describe("PrivacyView", () => {
    it("ui.audit.privacy: idle state offers both actions and no message", () => {
        const { container } = renderView()
        expect(container.querySelector("[data-state=\"idle\"]")).not.toBeNull()
        expect(screen.getByRole("button", { name: "Export my data" })).toBeEnabled()
        expect(screen.getByRole("button", { name: "Request erasure" })).toBeEnabled()
        expect(screen.getByRole("link", { name: "Back to tasks" })).toBeInTheDocument()
    })

    it("ui.audit.privacy: exporting state disables export and shows its busy label", () => {
        renderView({ state: "exporting" })
        expect(screen.getByRole("button", { name: "Exporting…" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "Request erasure" })).toBeEnabled()
    })

    it("ui.audit.privacy: requesting-erasure replaces the request action with a confirm/cancel pair", () => {
        renderView({ state: "requesting-erasure" })
        expect(screen.getByRole("button", { name: "Confirm erasure" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Request erasure" })).toBeNull()
    })

    it("ui.audit.privacy: erasure-pending disables both actions with a non-danger pending note", () => {
        renderView({ state: "erasure-pending" })
        expect(screen.getByRole("button", { name: "Export my data" })).toBeDisabled()
        expect(screen.getByRole("button", { name: "Request erasure" })).toBeDisabled()
        expect(screen.getByText("Submitting your erasure request…")).toBeInTheDocument()
    })

    it("ui.audit.privacy: erasure-complete removes both actions and confirms politely", () => {
        renderView({ state: "erasure-complete" })
        expect(screen.queryByRole("button", { name: "Export my data" })).toBeNull()
        expect(screen.queryByRole("button", { name: "Request erasure" })).toBeNull()
        expect(screen.getByText(/erasure request is complete/)).toBeInTheDocument()
    })

    it("ui.audit.privacy: erasure-refused announces the real refusal while export stays available", () => {
        const refusal = "We couldn't submit your erasure request. Try again."
        renderView({ state: "erasure-refused", refusal })
        expect(screen.getByText(refusal)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Export my data" })).toBeEnabled()
        expect(screen.getByRole("button", { name: "Request erasure" })).toBeEnabled()
    })

    it("ui.audit.privacy: every state in the closed vocabulary renders its own data-state", () => {
        for (const state of PRIVACY_STATES) {
            const { container, unmount } = renderView({ state })
            expect(container.querySelector(`[data-state="${state}"]`)).not.toBeNull()
            unmount()
        }
    })

    it("ui.audit.privacy: the shell carries the settled furniture - brand, four destinations, Alex, footer", () => {
        renderView()
        expect(screen.getAllByText("Todo app").length).toBeGreaterThan(0)
        for (const label of ["Tasks", "Notifications", "Plan", "Privacy"]) {
            expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0)
        }
        expect(screen.getAllByText("Alex").length).toBeGreaterThan(0)
        expect(screen.getByRole("link", { name: "Privacy policy" })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Terms" })).toBeInTheDocument()
        expect(screen.queryByRole("img")).toBeNull()
    })
})
