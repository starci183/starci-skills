import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { TasksPage } from "./index"
import { renderJourney, resetJourneyWorld, seedSession, serveGraphQL } from "@/testing/journey"

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))

/** The rows the backend's `tasks` query answers with - the wire spelling (`taskId`), which the
 * transport projects into the `Task` shape every row of the screen is built from. */
const ROW_ONE = { taskId: "t-1", title: "Water the plants", complete: false }
const ROW_TWO = { taskId: "t-2", title: "File the receipts", complete: true }

/** A session whose reads answer with `rows`; the same object reports what the screen sent. */
const signedInTaskList = (rows: ReadonlyArray<unknown>) => {
    seedSession("tok-list")
    return serveGraphQL({
        tasks: { data: rows },
        createTask: (variables) => ({ data: { taskId: "t-9", title: (variables.input as { title: string }).title } }),
        completeTask: { data: { taskId: "t-1", complete: true } },
        reopenTask: { data: { taskId: "t-1", complete: false } },
        deleteTask: { data: { deleted: true } },
    })
}

/**
 * The journey the sign-in run's last frame and `task/uat/create`'s video both end on: a reader who
 * already has a session opens their list and works through it. Mounted at the route's own page half,
 * so the shell, the connected block, the SWR hooks, the task transport and the GraphQL fetcher all
 * run in the order a reader's browser runs them.
 */
describe("ui.task.list journey: the served tasks screen over the real transport", () => {
    afterEach(() => {
        resetJourneyWorld()
        mocks.push.mockReset()
    })

    it("reads the viewer's own rows and sends them with the viewer's own session", async () => {
        const wire = signedInTaskList([ROW_ONE, ROW_TWO])
        renderJourney(<TasksPage />)

        await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2))
        expect(screen.getByText("Water the plants")).toBeInTheDocument()
        expect(screen.getByText("File the receipts")).toBeInTheDocument()
        expect(screen.getByRole("region", { name: /All tasks/ })).toHaveTextContent("2 tasks")

        const read = wire.callsFor("tasks")[0]
        expect(read.token).toBe("tok-list")
        expect(read.document).toContain("taskId title complete")
    })

    it("br.task.list.empty: a list the backend answers with nothing draws the first-task state, no rows and no tally", async () => {
        const wire = signedInTaskList([])
        renderJourney(<TasksPage />)

        await waitFor(() => expect(screen.getByText("No tasks yet. Add the first one.")).toBeInTheDocument())
        expect(screen.queryAllByRole("listitem")).toHaveLength(0)
        expect(wire.callsFor("tasks")).toHaveLength(1)
    })

    it("fr.task.create: a submitted title is sent for its own task, clears the draft and re-reads the list", async () => {
        const wire = signedInTaskList([ROW_ONE])
        renderJourney(<TasksPage />)
        await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1))

        fireEvent.change(screen.getByLabelText("New task"), { target: { value: "Ship the examples" } })
        fireEvent.click(screen.getByRole("button", { name: "Add task" }))

        await waitFor(() => expect(wire.callsFor("createTask")).toHaveLength(1))
        expect(wire.callsFor("createTask")[0].variables).toEqual({ input: { title: "Ship the examples" } })
        expect(wire.callsFor("createTask")[0].token).toBe("tok-list")
        await waitFor(() => expect(screen.getByLabelText("New task")).toHaveValue(""))
        await waitFor(() => expect(wire.reReadAfter("tasks", "createTask")).toBe(true))
    })

    it("ac.task.title.required.refuses-empty: whitespace alone never reaches the transport", async () => {
        const wire = signedInTaskList([ROW_ONE])
        renderJourney(<TasksPage />)
        await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1))

        fireEvent.change(screen.getByLabelText("New task"), { target: { value: "   " } })
        fireEvent.click(screen.getByRole("button", { name: "Add task" }))

        expect(wire.callsFor("createTask")).toHaveLength(0)
        expect(screen.getAllByRole("listitem")).toHaveLength(1)
    })

    it("ac.task.complete.once: checking an open row sends completeTask", async () => {
        const wire = signedInTaskList([ROW_ONE])
        renderJourney(<TasksPage />)
        await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1))

        screen.getByRole("checkbox").click()
        await waitFor(() => expect(wire.callsFor("completeTask")).toHaveLength(1))
        expect(wire.callsFor("completeTask")[0].variables).toEqual({ id: "t-1" })
        expect(wire.callsFor("reopenTask")).toHaveLength(0)
        await waitFor(() => expect(wire.reReadAfter("tasks", "completeTask")).toBe(true))
    })

    it("ac.task.complete.once.is-reversible: unchecking a done row sends reopenTask, never completeTask", async () => {
        seedSession("tok-reopen")
        const wire = serveGraphQL({
            tasks: { data: [ROW_TWO] },
            reopenTask: { data: { taskId: "t-2", complete: false } },
        })
        renderJourney(<TasksPage />)
        await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1))

        const checkbox = screen.getByRole("checkbox") as HTMLInputElement
        expect(checkbox.checked).toBe(true)
        checkbox.click()
        await waitFor(() => expect(wire.callsFor("reopenTask")).toHaveLength(1))
        expect(wire.callsFor("reopenTask")[0].variables).toEqual({ id: "t-2" })
        expect(wire.callsFor("completeTask")).toHaveLength(0)
    })

    it("br.task.delete.final: a row is deleted only after its inline confirmation names it, then the list re-reads", async () => {
        const wire = signedInTaskList([ROW_ONE])
        renderJourney(<TasksPage />)
        await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1))

        fireEvent.click(screen.getByRole("button", { name: "Delete" }))
        expect(screen.getByText(/Delete “Water the plants”\?/)).toBeInTheDocument()
        expect(wire.callsFor("deleteTask")).toHaveLength(0)

        fireEvent.click(screen.getByRole("button", { name: "Delete" }))
        await waitFor(() => expect(wire.callsFor("deleteTask")).toHaveLength(1))
        expect(wire.callsFor("deleteTask")[0].variables).toEqual({ id: "t-1" })
        await waitFor(() => expect(wire.reReadAfter("tasks", "deleteTask")).toBe(true))
    })

    it("ui.task.list: each row's Share and Schedule destinations carry that row's own task", async () => {
        signedInTaskList([ROW_ONE])
        renderJourney(<TasksPage />)
        await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1))

        expect(screen.getByRole("link", { name: "Share" })).toHaveAttribute("href", "/tasks/t-1/share")
        expect(screen.getByRole("link", { name: "Schedule" })).toHaveAttribute("href", "/tasks/t-1/schedule")
    })

    it("fr.login.session: a read the backend refuses for a dead session shows the session sentence and hides the work", async () => {
        seedSession("tok-expired")
        const wire = serveGraphQL({
            tasks: { reason: "The session is not active.", code: "SESSION_NOT_FOUND" },
        })
        renderJourney(<TasksPage />)

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Your session has ended. Sign in again to see your tasks."))
        expect(screen.queryByRole("button", { name: "Add task" })).not.toBeInTheDocument()
        expect(screen.queryAllByRole("listitem")).toHaveLength(0)
        expect(wire.callsFor("tasks")).toHaveLength(1)
    })

    it("the list is session-gated: with no token in the browser the screen asks the transport for nothing", () => {
        const wire = serveGraphQL({ tasks: { data: [ROW_ONE] } })
        renderJourney(<TasksPage />)

        expect(wire.calls).toHaveLength(0)
        expect(screen.getByText("No tasks yet. Add the first one.")).toBeInTheDocument()
    })

    it("fr.login.sign-out: signing out ends the session on the backend, drops the local token and lands on sign-in", async () => {
        seedSession("tok-signout")
        const wire = serveGraphQL({
            tasks: { data: [ROW_ONE] },
            signOut: { data: { signedOut: true } },
        })
        renderJourney(<TasksPage />)
        await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1))

        fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0])

        await waitFor(() => expect(wire.callsFor("signOut")).toHaveLength(1))
        expect(wire.callsFor("signOut")[0].variables).toEqual({ input: { sessionToken: "tok-signout" } })
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/sign-in"))
        expect(window.localStorage.getItem("todo-app.session-token")).toBeNull()
        // The dead session is never read from again by this screen.
        expect(wire.callsFor("tasks").every(call => call.token === "tok-signout")).toBe(true)
    })
})
