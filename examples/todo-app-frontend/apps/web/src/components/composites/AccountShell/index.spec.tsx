import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { GrammarRoot } from "@starci/grammar/common"
import { AccountShell, type AccountShellCopy } from "./index"

const copy: AccountShellCopy = {
    brand: "Todo app",
    accountName: "Alex",
    signOut: "Sign out",
    navLabel: "Primary",
    destinations: { tasks: "Tasks", notifications: "Notifications", plan: "Plan", privacy: "Privacy" },
    legal: { privacyPolicy: "Privacy policy", terms: "Terms" },
    breadcrumbLabel: "Breadcrumb",
    mainLabel: "The screen",
    breadcrumb: "Settings / Notifications",
}

const renderShell = (onSignOut = () => {}) =>
    render(
        <GrammarRoot>
            <AccountShell copy={copy} currentHref="/notify/preferences" onSignOut={onSignOut}>
                <p>screen content</p>
            </AccountShell>
        </GrammarRoot>,
    )

describe("AccountShell", () => {
    it("draws the screen's content between the breadcrumb and the legal footer", () => {
        renderShell()
        expect(screen.getByRole("main", { name: "The screen" })).toBeInTheDocument()
        expect(screen.getByText("screen content")).toBeInTheDocument()
        expect(screen.getByText("Settings / Notifications")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms")
    })

    it("marks only the destination this screen is as current", () => {
        renderShell()
        const notifications = screen.getAllByRole("link", { name: "Notifications" })
        expect(notifications.length).toBeGreaterThan(0)
        for (const link of notifications) expect(link).toHaveAttribute("aria-current")
        for (const link of screen.getAllByRole("link", { name: "Tasks" })) expect(link).not.toHaveAttribute("aria-current")
    })

    it("reports the sign-out intent", () => {
        const onSignOut = vi.fn()
        renderShell(onSignOut)
        fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0])
        expect(onSignOut).toHaveBeenCalled()
    })
})
