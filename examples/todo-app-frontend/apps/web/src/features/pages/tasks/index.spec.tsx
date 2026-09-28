import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    clearToken: vi.fn(),
    signOut: vi.fn(() => Promise.resolve(true)),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("@/hooks/auth", () => ({ useSessionToken: () => "session-token" }))
vi.mock("@/modules/session", () => ({ clearToken: mocks.clearToken }))
vi.mock("@/modules/api/auth", () => ({ signOut: mocks.signOut }))
vi.mock("@/components/blocks/task-list", () => ({ TaskListBlock: () => <div data-testid="task-list-block" /> }))

import { TasksPage } from "./index"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import messages from "../../../messages/en.json"

/** The entry resolves its copy through next-intl, so the spec supplies the en catalogue - the same
 * words an English reader sees, which is what the assertions below are written against. */
const withIntl = (children: ReactNode) => (
    <NextIntlClientProvider locale="en" messages={messages}>
        {children}
    </NextIntlClientProvider>
)

describe("TasksPage", () => {
    it("ui.task.list: the workspace shell carries the Todo app brand, the named destinations and the account presence", () => {
        render(withIntl(<TasksPage />))
        expect(screen.getAllByText("Todo app").length).toBeGreaterThan(0)
        expect(screen.getAllByRole("navigation", { name: "Primary" }).length).toBeGreaterThan(0)
        for (const label of ["Tasks", "Notifications", "Plan", "Privacy"]) {
            expect(screen.getAllByRole("link", { name: label }).length).toBeGreaterThan(0)
        }
        expect(screen.getAllByText("Alex").length).toBeGreaterThan(0)
    })

    it("ui.task.list: Tasks is the current destination and the other three carry their recorded hrefs", () => {
        render(withIntl(<TasksPage />))
        const tasks = screen.getAllByRole("link", { name: "Tasks" })[0]
        expect(tasks).toHaveAttribute("href", "/tasks")
        expect(tasks).toHaveAttribute("aria-current")
        expect(screen.getAllByRole("link", { name: "Notifications" })[0]).toHaveAttribute("href", "/notify/preferences")
        expect(screen.getAllByRole("link", { name: "Plan" })[0]).toHaveAttribute("href", "/plan/usage")
        expect(screen.getAllByRole("link", { name: "Privacy" })[0]).toHaveAttribute("href", "/privacy")
    })

    it("ui.task.list: exactly one main landmark, named after the screen it holds", () => {
        render(withIntl(<TasksPage />))
        expect(screen.getAllByRole("main")).toHaveLength(1)
        expect(screen.getByRole("main")).toHaveAccessibleName("The task list and its create form")
    })

    it("ui.task.list: Sign out clears the session and lands on sign-in", () => {
        render(withIntl(<TasksPage />))
        screen.getAllByRole("button", { name: "Sign out" })[0].click()
        expect(mocks.clearToken).toHaveBeenCalled()
        expect(mocks.signOut).toHaveBeenCalledWith("session-token")
        expect(mocks.push).toHaveBeenCalledWith("/sign-in")
    })

    it("ui.task.list: the footer carries the recorded legal destinations", () => {
        render(withIntl(<TasksPage />))
        expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy-policy")
        expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms")
    })
})
