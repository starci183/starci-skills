import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { ShareInviteView } from "./component"
import type { Collaborator } from "@/modules/api/share"

const noop = () => {}

const pending: Collaborator = { id: "inv-1", email: "pat@example.com", role: "viewer", status: "pending" }
const accepted: Collaborator = { id: "inv-2", email: "sam@example.com", role: "editor", status: "accepted" }

const baseProps = {
    collaborators: [] as ReadonlyArray<Collaborator>,
    taskTitle: "Buy milk",
    refusal: null,
    refusalTarget: "email" as const,
    email: "",
    role: "viewer" as const,
    revokingId: null,
    copy: {
        brand: "Todo app",
        accountName: "Alex",
        signOut: "Sign out",
        navLabel: "Primary destinations",
        breadcrumbLabel: "Breadcrumb",
        destinations: { tasks: "Tasks", notifications: "Notifications", plan: "Plan", privacy: "Privacy" },
        legal: { privacyPolicy: "Privacy policy", terms: "Terms" },
        backToTask: "Back to task",
        mainLabel: "The invitation screen and the collaborator list",
        breadcrumbSharing: "Sharing",
        heading: "Share this task",
        cardLabel: "Invite collaborators",
        inviteHeading: "Invite a collaborator",
        inviteTagline: "Choose who can view or edit this task.",
        emailLabel: "Email address",
        roleLabel: "Role",
        roles: { viewer: "Viewer", editor: "Editor" },
        roleHint: "Viewers can read. Editors can complete the task.",
        sendInvitation: "Send invitation",
        collaborators: "Collaborators",
        pendingExpiry: "Pending invitations expire after 14 days.",
        columnPerson: "Person",
        columnAccess: "Access",
        columnStatus: "Status",
        statuses: { pending: "Pending", accepted: "Accepted", expired: "Expired", revoked: "Revoked" },
        revoke: "Revoke",
    },
    onEmailChange: noop,
    onRoleChange: noop,
    onInvite: noop,
    onRevoke: noop,
    onSignOut: noop,
}

describe("ShareInviteView", () => {
    it("ui.share.invite: empty state shows only the invite form, no collaborator section", () => {
        render(<ShareInviteView {...baseProps} state="empty" />)
        expect(screen.getByRole("button", { name: "Send invitation" })).toBeInTheDocument()
        expect(screen.getByLabelText("Email address")).toBeInTheDocument()
        expect(screen.queryByRole("heading", { name: "Collaborators" })).not.toBeInTheDocument()
        expect(screen.queryByText("pat@example.com")).not.toBeInTheDocument()
    })

    it("ui.share.invite: inviting state disables the form and marks the invite button pending", () => {
        render(<ShareInviteView {...baseProps} state="inviting" collaborators={[pending]} />)
        const inviteButton = screen.getByRole("button", { name: "Send invitation" })
        expect(inviteButton).toBeDisabled()
        expect(screen.getByLabelText("Email address")).toBeDisabled()
        for (const radio of screen.getAllByRole("radio")) {
            expect(radio).toBeDisabled()
        }
    })

    it("ui.share.invite: pending-list state shows the collaborators region with role and revoke", () => {
        render(<ShareInviteView {...baseProps} state="pending-list" collaborators={[pending]} />)
        expect(screen.getByRole("heading", { name: "Collaborators" })).toBeInTheDocument()
        expect(screen.getByText("pat@example.com")).toBeInTheDocument()
        expect(screen.getAllByText("Viewer").length).toBeGreaterThanOrEqual(2)
        expect(screen.getByText("Pending")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument()
    })

    it("ui.share.invite: accepted state shows the accepted status and keeps revoke available", () => {
        render(<ShareInviteView {...baseProps} state="accepted" collaborators={[accepted]} />)
        expect(screen.getByText("sam@example.com")).toBeInTheDocument()
        expect(screen.getByText("Accepted")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument()
    })

    it("ui.share.invite: refused state retains the entered email, the role choice, an assertive refusal and the rows", () => {
        const inviteRole = "editor" as const
        render(
            <ShareInviteView
                {...baseProps}
                state="refused"
                collaborators={[pending, accepted]}
                email="not-an-email"
                role={inviteRole}
                refusal="Enter a valid email address."
            />,
        )
        const email = screen.getByLabelText("Email address") as HTMLInputElement
        expect(email.value).toBe("not-an-email")
        expect((screen.getByRole("radio", { name: "Editor" }) as HTMLInputElement).checked).toBe(true)
        expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.")
        expect(screen.getByText("pat@example.com")).toBeInTheDocument()
        expect(screen.getByText("sam@example.com")).toBeInTheDocument()
    })

    it("ui.share.invite: refused state can also place the assertive refusal on the form", () => {
        render(
            <ShareInviteView
                {...baseProps}
                state="refused"
                refusalTarget="form"
                refusal="That invitation could not be sent."
            />,
        )
        expect(screen.getByRole("alert")).toHaveTextContent("That invitation could not be sent.")
    })

    it("fr.share.invite: viewer/editor is a labelled native radio group and the choice reports through onRoleChange", () => {
        const onRoleChange = vi.fn()
        render(<ShareInviteView {...baseProps} state="empty" onRoleChange={onRoleChange} />)
        const radios = screen.getAllByRole("radio")
        expect(radios).toHaveLength(2)
        expect((screen.getByRole("radio", { name: "Viewer" }) as HTMLInputElement).checked).toBe(true);
        (screen.getByRole("radio", { name: "Editor" }) as HTMLInputElement).click()
        expect(onRoleChange).toHaveBeenCalledWith("editor")
    })

    it("fr.share.invite: submitting the form reports through onInvite", () => {
        const onInvite = vi.fn()
        render(<ShareInviteView {...baseProps} state="empty" onInvite={onInvite} />)
        const form = screen.getByRole("button", { name: "Send invitation" }).closest("form")
        expect(form).not.toBeNull()
        if (form !== null) fireEvent.submit(form)
        expect(onInvite).toHaveBeenCalledTimes(1)
    })

    it("fr.share.revoke: only live invitations offer revoke and it reports the row identity", () => {
        const onRevoke = vi.fn()
        const expired: Collaborator = { id: "inv-3", email: "old@example.com", role: "viewer", status: "expired" }
        render(<ShareInviteView {...baseProps} state="accepted" collaborators={[pending, expired]} onRevoke={onRevoke} />)
        const revokeButtons = screen.getAllByRole("button", { name: "Revoke" })
        expect(revokeButtons).toHaveLength(1)
        revokeButtons[0].click()
        expect(onRevoke).toHaveBeenCalledWith("inv-1", "pat@example.com")
        expect(screen.getByText("Expired")).toBeInTheDocument()
    })

    it("fr.share.list: every row shows email, role and status", () => {
        render(<ShareInviteView {...baseProps} state="accepted" collaborators={[pending, accepted]} />)
        expect(screen.getByText("pat@example.com")).toBeInTheDocument()
        expect(screen.getByText("sam@example.com")).toBeInTheDocument()
        expect(screen.getByText("Pending")).toBeInTheDocument()
        expect(screen.getByText("Accepted")).toBeInTheDocument()
        expect(screen.getAllByText("Viewer").length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText("Editor").length).toBeGreaterThanOrEqual(1)
    })

    it("ui.shell: the breadcrumb and Back to task point at the real task destination", () => {
        render(<ShareInviteView {...baseProps} state="empty" />)
        const back = screen.getByRole("link", { name: "Back to task" })
        expect(back).toHaveAttribute("href", "/tasks")
        const breadcrumbLinks = screen.getAllByRole("link", { name: "Tasks" })
        expect(breadcrumbLinks[0]).toHaveAttribute("href", "/tasks")
        expect(screen.getByRole("link", { name: "Buy milk" })).toHaveAttribute("href", "/tasks")
    })
})
