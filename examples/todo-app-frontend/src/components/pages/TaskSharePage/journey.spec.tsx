import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { TaskSharePage } from "./index"
import { renderJourney, resetJourneyWorld, seedSession, serveGraphQL, type Wire, type WireRoute } from "@/testing/journey"

const mocks = vi.hoisted(() => ({ push: vi.fn(), confirm: vi.fn(() => true) }))

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push }),
    useParams: () => ({ taskId: "t-7" }),
}))

const TASK_TITLE = "Water the plants"
const COLLABORATOR = "sam@example.com"

/** One collaborator row in the wire spelling `listCollaborators` unwraps. */
const row = (invitationId: string, status: string, role = "viewer") => ({
    invitationId,
    email: COLLABORATOR,
    role,
    status,
})

/** The screen's defaults: a live session, an empty list, the titled task the route addresses.
 *
 * `window.confirm` is answered by the spec because a headless run has no dialog button to press -
 * the revoke path around it, including the sentence the dialog carries, runs for real.
 */
const shareWorld = (overrides: Readonly<Record<string, WireRoute>> = {}): Wire => {
    seedSession("tok-share")
    vi.spyOn(window, "confirm").mockImplementation(mocks.confirm)
    return serveGraphQL({
        collaborators: { data: [] },
        tasks: { data: [{ taskId: "t-7", title: TASK_TITLE, complete: false }] },
        invite: (variables, call) => {
            const input = variables.input as { email: string; role: string }
            return {
                data: { invitationId: `inv-${call + 1}`, taskId: "t-7", email: input.email, role: input.role, status: "pending" },
            }
        },
        revokeCollaborator: { data: { invitationId: "inv-1", status: "revoked" } },
        ...overrides,
    })
}

/**
 * The journey `share/uat/invite-and-collaborate` walked: the owner of a task opens its share
 * screen, invites a person at a role, and can take that access back. Mounted at the route's own
 * page half, so the `[taskId]` segment, the connected block, the four share hooks, the share
 * transport and the GraphQL fetcher run in the order a reader's browser runs them.
 */
describe("ui.share.invite journey: the served share screen over the real transport", () => {
    let wire: Wire

    afterEach(() => {
        resetJourneyWorld()
        mocks.push.mockReset()
        mocks.confirm.mockReturnValue(true)
        vi.restoreAllMocks()
    })

    /** Wait for the screen's first read to settle, so a later assertion is about the journey. */
    const openScreen = async () => {
        const view = renderJourney(<TaskSharePage />)
        await waitFor(() => expect(wire.callsFor("collaborators")).toHaveLength(1))
        return view
    }

    it("names the task the route addresses and reads its invitations with the reader's own session", async () => {
        wire = shareWorld()
        await openScreen()

        expect(screen.getByRole("heading", { name: "Share this task" })).toBeInTheDocument()
        await waitFor(() => expect(screen.getByText(TASK_TITLE)).toBeInTheDocument())
        const read = wire.callsFor("collaborators")[0]
        expect(read.variables).toEqual({ taskId: "t-7" })
        expect(read.token).toBe("tok-share")
    })

    it("empty: with no invitations the card offers the invite and the list is absent", async () => {
        wire = shareWorld()
        await openScreen()

        expect(screen.getByRole("heading", { name: "Invite a collaborator" })).toBeInTheDocument()
        expect(screen.queryByText("Collaborators")).not.toBeInTheDocument()
        expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument()
    })

    it("pending-list: a pending invitation is listed with its person, role, status and the expiry note", async () => {
        wire = shareWorld({ collaborators: { data: [row("inv-1", "pending")] } })
        const { container } = await openScreen()
        await waitFor(() => expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument())

        expect(container.querySelector("[data-state=\"pending-list\"]")).not.toBeNull()
        expect(screen.getByRole("listitem")).toHaveTextContent(COLLABORATOR)
        expect(screen.getByRole("listitem")).toHaveTextContent("Viewer")
        expect(screen.getByRole("listitem")).toHaveTextContent("Pending")
        expect(screen.getByText("Pending invitations expire after 14 days.")).toBeInTheDocument()
    })

    it("accepted: one accepted invitation turns the whole screen to its own state", async () => {
        wire = shareWorld({ collaborators: { data: [row("inv-1", "pending"), row("inv-2", "accepted", "editor")] } })
        const { container } = await openScreen()
        await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2))

        expect(container.querySelector("[data-state=\"accepted\"]")).not.toBeNull()
        expect(screen.getAllByRole("button", { name: "Revoke" })).toHaveLength(2)
    })

    it("br.share.role.permissions: the two roles are the only choice, and the chosen one is what travels", async () => {
        wire = shareWorld()
        await openScreen()

        expect(screen.getByRole("radio", { name: "Viewer" })).toBeChecked()
        expect(screen.getByRole("radio", { name: "Editor" })).not.toBeChecked()

        fireEvent.change(screen.getByLabelText("Email address"), { target: { value: COLLABORATOR } })
        fireEvent.click(screen.getByRole("radio", { name: "Editor" }))
        fireEvent.click(screen.getByRole("button", { name: "Send invitation" }))

        await waitFor(() => expect(wire.callsFor("invite")).toHaveLength(1))
        expect(wire.callsFor("invite")[0].variables).toEqual({ input: { taskId: "t-7", email: COLLABORATOR, role: "editor" } })
        expect(wire.callsFor("invite")[0].token).toBe("tok-share")
    })

    it("fr.share.invite: an accepted invite clears the draft and the list is read again", async () => {
        wire = shareWorld()
        await openScreen()

        fireEvent.change(screen.getByLabelText("Email address"), { target: { value: COLLABORATOR } })
        fireEvent.click(screen.getByRole("button", { name: "Send invitation" }))

        await waitFor(() => expect(screen.getByLabelText("Email address")).toHaveValue(""))
        await waitFor(() => expect(wire.reReadAfter("collaborators", "invite")).toBe(true))
    })

    it.each([
        ["SHARE_INVALID_EMAIL", "not-an-email"],
        ["SHARE_INVITATION_ALREADY_EXISTS", COLLABORATOR],
    ])("br.share.invite: %s is drawn on the email field, because that field owns it", async (code, address) => {
        wire = shareWorld({ invite: { reason: "The address was refused.", code } })
        await openScreen()

        fireEvent.change(screen.getByLabelText("Email address"), { target: { value: address } })
        fireEvent.click(screen.getByRole("button", { name: "Send invitation" }))

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address."))
        expect(screen.getByRole("alert").closest("form")).not.toBeNull()
    })

    it("fr.share.revoke: a refusal no field owns is drawn on the form", async () => {
        wire = shareWorld({
            collaborators: { data: [row("inv-1", "pending")] },
            revokeCollaborator: { reason: "That invitation is already closed.", code: "SHARE_INVITATION_CLOSED" },
        })
        await openScreen()
        await waitFor(() => expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument())

        fireEvent.click(screen.getByRole("button", { name: "Revoke" }))
        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That invitation is already closed."))
        expect(screen.getByRole("alert").closest("form")).toBeNull()
    })

    it("fr.share.revoke: the owner is asked first, and a declined confirmation sends nothing", async () => {
        wire = shareWorld({ collaborators: { data: [row("inv-1", "pending")] } })
        mocks.confirm.mockReturnValue(false)
        await openScreen()
        await waitFor(() => expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument())

        fireEvent.click(screen.getByRole("button", { name: "Revoke" }))
        expect(mocks.confirm).toHaveBeenCalledWith(`Revoke ${COLLABORATOR}'s access to this task?`)
        expect(screen.getByRole("listitem")).toBeInTheDocument()
        expect(wire.callsFor("revokeCollaborator")).toHaveLength(0)
    })

    it("fr.share.revoke: a confirmed revoke closes the invitation it names and re-reads the list", async () => {
        wire = shareWorld({ collaborators: { data: [row("inv-1", "pending")] } })
        await openScreen()
        await waitFor(() => expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument())

        fireEvent.click(screen.getByRole("button", { name: "Revoke" }))
        await waitFor(() => expect(wire.callsFor("revokeCollaborator")).toHaveLength(1))
        expect(wire.callsFor("revokeCollaborator")[0].variables).toEqual({ input: { invitationId: "inv-1" } })
        await waitFor(() => expect(wire.reReadAfter("collaborators", "revokeCollaborator")).toBe(true))
    })

    it("br.share.revoke.once: a closed invitation is still listed, but there is nothing left to revoke", async () => {
        wire = shareWorld({ collaborators: { data: [row("inv-1", "expired"), row("inv-2", "revoked")] } })
        await openScreen()
        await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2))

        expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument()
        expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Expired")
        expect(screen.getAllByRole("listitem")[1]).toHaveTextContent("Revoked")
    })

    it("fr.login.session: a list the backend refuses for a dead session says so and lists nothing", async () => {
        wire = shareWorld({
            collaborators: { reason: "The session is not active.", code: "SESSION_NOT_FOUND" },
            tasks: { reason: "The session is not active.", code: "SESSION_NOT_FOUND" },
        })
        await openScreen()

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Your session has ended. Sign in again to see this task's collaborators."))
        expect(screen.queryByText("Pending invitations expire after 14 days.")).not.toBeInTheDocument()
        expect(screen.queryAllByRole("listitem")).toHaveLength(0)
    })

    it("the task title is page furniture: a refused task read leaves the invitation screen working", async () => {
        wire = shareWorld({
            collaborators: { data: [row("inv-1", "pending")] },
            tasks: { reason: "This task belongs to somebody else.", code: "TASK_FORBIDDEN" },
        })
        const { container } = await openScreen()
        await waitFor(() => expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument())

        expect(container.querySelector("[data-state=\"pending-list\"]")).not.toBeNull()
        expect(screen.queryByText(TASK_TITLE)).not.toBeInTheDocument()
        expect(screen.queryAllByRole("alert")).toHaveLength(0)
    })

    it("shell.sign-out: leaving the share screen returns the reader to sign-in with no session left behind", async () => {
        wire = shareWorld({ collaborators: { data: [row("inv-1", "pending")] } })
        await openScreen()
        await waitFor(() => expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument())

        fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0])
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/sign-in"))
        expect(window.localStorage.getItem("todo-app.session-token")).toBeNull()
    })
})
