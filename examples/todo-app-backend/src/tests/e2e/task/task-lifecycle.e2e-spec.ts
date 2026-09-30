import { randomUUID } from "node:crypto"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import { present } from "../setup/e2e.error"
import type {
    CompleteTaskData,
    CreateTaskData,
    DeleteTaskData,
    ReopenTaskData,
    SignOutData,
    TaskCountsData,
    TasksData,
} from "../setup/e2e-views.contracts"

/**
 * fr.task.* as one A->Z journey over the real stack: sign in, create a task, read it back out of the list, complete it,
 * reopen it, watch taskCounts track each transition, delete it, then sign out and find the door closed. The Postgres reads
 * are out-of-band verification only: every step of the journey itself travels the real /graphql door.
 */
describe("task lifecycle (e2e)", () => {
    let world: E2EWorld

    beforeAll(async () => {
        world = await bootE2eWorld("task/task-lifecycle")
        // The stack counts as up only when the api answers its dependency-checked /health.
        expect((await world.http().get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 600_000)

    afterAll(async () => {
        await world.close()
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("sign-in -> create -> list -> complete -> reopen -> counts -> delete -> sign-out", async () => {
        const { graphql, auth, database } = world
        const title = `e2e lifecycle ${randomUUID()}`
        const session = await auth.signInAs("owner")
        const caller = graphql.client(session.sessionToken)

        const countsOf = async (): Promise<TaskCountsData["taskCounts"]> => {
            const observed = await caller.read<TaskCountsData>("taskCounts")
            expect(observed.errors).toBeNull()
            return present(observed.data, "taskCounts data").taskCounts
        }
        const baseline = await countsOf()

        const created = await caller.mutate<CreateTaskData>("createTask", { variables: { input: { title } } })
        expect(created.errors).toBeNull()
        const createdTask = present(created.data, "createTask data").createTask
        const taskId = createdTask.taskId
        expect(createdTask.title).toBe(title)

        // There is no single-task query in this schema: a task is read back out of its owner list.
        const listed = await caller.read<TasksData>("tasks")
        expect(listed.errors).toBeNull()
        expect(listed.data?.tasks.find((task) => task.taskId === taskId)).toEqual({ taskId, title, complete: false })
        expect(await countsOf()).toEqual({ open: baseline.open + 1, complete: baseline.complete })

        const completed = await caller.mutate<CompleteTaskData>("completeTask", { variables: { input: { id: taskId } } })
        expect(completed.errors).toBeNull()
        expect(completed.data?.completeTask).toEqual({ taskId, complete: true })
        expect(await countsOf()).toEqual({ open: baseline.open, complete: baseline.complete + 1 })

        // Out-of-band: the row itself carries the owner, the flag and a real completed_at.
        const doneRows = await database.taskById(taskId)
        expect(doneRows).toHaveLength(1)
        expect(doneRows[0]).toMatchObject({ id: taskId, owner: session.personId, title, complete: true })
        expect(doneRows[0]?.completed_at).not.toBeNull()

        const reopened = await caller.mutate<ReopenTaskData>("reopenTask", { variables: { input: { id: taskId } } })
        expect(reopened.errors).toBeNull()
        expect(reopened.data?.reopenTask).toEqual({ taskId, complete: false })
        expect(await countsOf()).toEqual({ open: baseline.open + 1, complete: baseline.complete })
        const relisted = await caller.read<TasksData>("tasks")
        expect(relisted.data?.tasks.find((task) => task.taskId === taskId)).toEqual({ taskId, title, complete: false })
        const reopenedRows = await database.taskById(taskId)
        expect(reopenedRows[0]?.complete).toBe(false)
        expect(reopenedRows[0]?.completed_at).toBeNull()

        const deleted = await caller.mutate<DeleteTaskData>("deleteTask", { variables: { input: { id: taskId } } })
        expect(deleted.errors).toBeNull()
        expect(deleted.data?.deleteTask.deleted).toBe(true)
        expect(await database.taskById(taskId)).toEqual([])
        expect(await countsOf()).toEqual(baseline)
        const gone = await caller.mutate<CompleteTaskData>("completeTask", { variables: { input: { id: taskId } } })
        expect(gone.errorCode).toBe("TASK_NOT_FOUND")

        // The session row exists while the journey uses it; sign-out must take it away.
        expect(await database.sessionCountByToken(session.sessionToken)).toBe(1)
        const signedOut = await graphql.client().mutate<SignOutData>("signOut", { variables: { input: { sessionToken: session.sessionToken } } })
        expect(signedOut.errors).toBeNull()
        expect(signedOut.data?.signOut.signedOut).toBe(true)
        const after = await caller.read<TasksData>("tasks")
        expect(after.errorCode).toBe("SESSION_NOT_FOUND")
        expect(after.data).toBeNull()
        expect(await database.sessionCountByToken(session.sessionToken)).toBe(0)
    })
})
