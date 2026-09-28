import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { UsageScreenView } from "./component"

const noop = () => {}

const baseProps = {
    plan: "free",
    activeCount: 40,
    cap: 20,
    readRefusal: null,
    upgradeRefusal: null,
    isUpgrading: false,
    copy: {
        brand: "Todo app",
        accountName: "Alex",
        signOut: "Sign out",
        navLabel: "Primary destinations",
        destinations: { tasks: "Tasks", notifications: "Notifications", plan: "Plan", privacy: "Privacy" },
        legal: { privacyPolicy: "Privacy policy", terms: "Terms" },
        mainLabel: "The usage screen and its upgrade action",
        breadcrumb: "Settings / Plan",
        heading: "Plan and usage",
        usageCard: "Usage",
        freePlan: "Free plan",
        paidPlan: "Paid plan",
        formatActiveTasks: (count: number) => `${count} active tasks`,
        formatFreePlanLimit: (cap: number) => `Free plan limit: ${cap}`,
        progressLabel: "Tasks used against your free plan cap",
        formatPercentOfCap: (percent: number) => `${percent}% of cap`,
        formatAtCap: (cap: number) => `You have used all ${cap} active tasks on your free plan — the next task you try to create will be refused.`,
        formatOverCapCount: (count: number, cap: number) => `You have ${count} active tasks, which exceeds your free plan limit of ${cap}.`,
        formatOverCapPaused: (cap: number) => `Task creation is paused. Your free plan allows ${cap} active tasks.`,
        overCapNote: "Your existing tasks are safe. Complete or delete tasks to make room, or upgrade for no task cap.",
        upgrade: "Upgrade plan",
        manageTasks: "Manage tasks",
        completeFreesSpace: "Completing tasks frees up space.",
    },
    onUpgrade: noop,
    onSignOut: noop,
}

describe("UsageScreenView", () => {
    it("ui.plan.usage: over-cap-frozen shows 40 active tasks against the 20 cap, creation paused, both actions", () => {
        render(<UsageScreenView {...baseProps} state="over-cap-frozen" />)

        expect(screen.getByRole("heading", { name: "Plan and usage" })).toBeInTheDocument()
        expect(screen.getByText("40 active tasks")).toBeInTheDocument()
        expect(screen.getByText("Free plan limit: 20")).toBeInTheDocument()
        expect(screen.getByText("200% of cap")).toBeInTheDocument()
        expect(screen.getByRole("progressbar", { name: "Tasks used against your free plan cap" })).toBeInTheDocument()
        expect(screen.getByText(/exceeds your free plan limit of 20/)).toBeInTheDocument()
        expect(screen.getByText(/Task creation is paused/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Upgrade plan" })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Manage tasks" })).toHaveAttribute("href", "/tasks")
        expect(screen.getByText("Completing tasks frees up space.")).toBeInTheDocument()
    })

    it("ui.plan.usage: under-cap shows a plain usage count with no warning and no upgrade prompt", () => {
        render(<UsageScreenView {...baseProps} state="under-cap" activeCount={7} />)

        expect(screen.getByText("7 active tasks")).toBeInTheDocument()
        expect(screen.getByText("35% of cap")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Upgrade plan" })).not.toBeInTheDocument()
        expect(screen.queryByText(/Task creation is paused/)).not.toBeInTheDocument()
        expect(screen.queryByText(/will be refused/)).not.toBeInTheDocument()
    })

    it("ui.plan.usage: at-cap warns the next create will be refused and offers the upgrade action", () => {
        render(<UsageScreenView {...baseProps} state="at-cap" activeCount={20} />)

        expect(screen.getByText("20 active tasks")).toBeInTheDocument()
        expect(screen.getByText("100% of cap")).toBeInTheDocument()
        expect(screen.getByText(/the next task you try to create will be refused/)).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Upgrade plan" })).toBeInTheDocument()
        expect(screen.queryByText(/Task creation is paused/)).not.toBeInTheDocument()
    })

    it("ui.plan.usage: paid-unlimited removes the cap and the upgrade action, keeping only the count", () => {
        render(<UsageScreenView {...baseProps} state="paid-unlimited" plan="paid" cap={null} />)

        expect(screen.getByText("Paid plan")).toBeInTheDocument()
        expect(screen.getByText("40 active tasks")).toBeInTheDocument()
        expect(screen.queryByText(/Free plan limit/)).not.toBeInTheDocument()
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Upgrade plan" })).not.toBeInTheDocument()
    })

    it("ui.plan.usage: refused announces the session refusal assertively", () => {
        render(<UsageScreenView {...baseProps} state="refused" readRefusal="Your session has ended. Sign in again to see your plan usage." />)

        expect(screen.getByText("Your session has ended. Sign in again to see your plan usage.")).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Upgrade plan" })).not.toBeInTheDocument()
    })

    it("ui.plan.usage: the shell carries the four destinations, account presence and the footer links", () => {
        render(<UsageScreenView {...baseProps} state="over-cap-frozen" />)

        expect(screen.getAllByRole("link", { name: "Tasks" })[0]).toHaveAttribute("href", "/tasks")
        expect(screen.getAllByRole("link", { name: "Notifications" })[0]).toHaveAttribute("href", "/notify/preferences")
        expect(screen.getAllByRole("link", { name: "Privacy" })[0]).toHaveAttribute("href", "/privacy")
        expect(screen.getAllByText("Alex").length).toBeGreaterThan(0)
        expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy-policy")
        expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms")
    })

    it("ui.plan.usage: the upgrade press hands the checkout intent to the owner", () => {
        const onUpgrade = vi.fn()
        render(<UsageScreenView {...baseProps} state="over-cap-frozen" onUpgrade={onUpgrade} />)

        screen.getByRole("button", { name: "Upgrade plan" }).click()
        expect(onUpgrade).toHaveBeenCalledTimes(1)
    })
})
