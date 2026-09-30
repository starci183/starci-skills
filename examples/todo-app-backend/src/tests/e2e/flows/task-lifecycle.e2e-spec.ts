import { randomUUID } from "node:crypto"
import { IdentityErrorCode } from "@modules/domain/identity"
import { TaskErrorCode } from "@modules/domain/task"
import { SESSION_COUNT_BY_TOKEN, TASK_BY_ID } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { CountRow, TaskRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type {
    CompleteTaskData,
    CreateTaskData,
    DeleteTaskData,
    ReopenTaskData,
    SignOutData,
    TaskCountsData,
    TasksData,
} from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/use-test-world"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"

/**
 * fr.task.* as one A->Z journey over the real api: sign in, create a task, read it back out of the list, complete it,
 * reopen it, watch taskCounts track each transition, delete it, then sign out and find the door closed. The persisted-state
 * reads go through the shared entity manager; every step of the journey itself travels the real /graphql door.
 */
describe("task lifecycle (e2e)", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true } } })

    it("sign-in -> create -> list -> complete -> reopen -> counts -> delete -> sign-out", async () => {
        const { api } = world.apps.todo
        const title = `e2e lifecycle ${randomUUID()}`
        const person = await world.signedInPerson("lifecycle")
        const caller = person.caller

        const countsOf = async (): Promise<TaskCountsData["taskCounts"] | undefined> => {
            const observed = await caller.graphql<TaskCountsData>("taskCounts")
            expect(observed.errors).toBeNull()
            return observed.data?.taskCounts
        }
        const rowOf = async (taskId: string): Promise<Array<TaskRow>> => world.db.primary.query(TASK_BY_ID, [taskId])
        const sessionCount = async (): Promise<number> => {
            const [row]: Array<CountRow> = await world.db.primary.query(SESSION_COUNT_BY_TOKEN, [person.sessionToken])
            return row?.count ?? 0
        }
        // A new person owns nothing yet.
        const baseline = { open: 0, complete: 0 }
        expect(await countsOf()).toEqual(baseline)

        const created = await caller.graphql<CreateTaskData>("createTask", { input: { title } })
        expect(created.errors).toBeNull()
        const taskId = created.data?.createTask.taskId ?? ""
        expect(created.data?.createTask.title).toBe(title)

        // There is no single-task query in this schema: a task is read back out of its owner list.
        const listed = await caller.graphql<TasksData>("tasks")
        expect(listed.errors).toBeNull()
        expect(listed.data?.tasks.find((task) => task.taskId === taskId)).toEqual({ taskId, title, complete: false })
        expect(await countsOf()).toEqual({ open: baseline.open + 1, complete: baseline.complete })

        const completed = await caller.graphql<CompleteTaskData>("completeTask", { input: { id: taskId } })
        expect(completed.errors).toBeNull()
        expect(completed.data?.completeTask).toEqual({ taskId, complete: true })
        expect(await countsOf()).toEqual({ open: baseline.open, complete: baseline.complete + 1 })

        // The row itself carries the owner, the flag and a real completed_at.
        const doneRows = await rowOf(taskId)
        expect(doneRows).toHaveLength(1)
        expect(doneRows[0]).toMatchObject({ id: taskId, owner: person.personId, title, complete: true })
        expect(doneRows[0]?.completed_at).not.toBeNull()

        const reopened = await caller.graphql<ReopenTaskData>("reopenTask", { input: { id: taskId } })
        expect(reopened.errors).toBeNull()
        expect(reopened.data?.reopenTask).toEqual({ taskId, complete: false })
        expect(await countsOf()).toEqual({ open: baseline.open + 1, complete: baseline.complete })
        const relisted = await caller.graphql<TasksData>("tasks")
        expect(relisted.data?.tasks.find((task) => task.taskId === taskId)).toEqual({ taskId, title, complete: false })
        const reopenedRows = await rowOf(taskId)
        expect(reopenedRows[0]?.complete).toBe(false)
        expect(reopenedRows[0]?.completed_at).toBeNull()

        const deleted = await caller.graphql<DeleteTaskData>("deleteTask", { input: { id: taskId } })
        expect(deleted.errors).toBeNull()
        expect(deleted.data?.deleteTask.deleted).toBe(true)
        expect(await rowOf(taskId)).toEqual([])
        expect(await countsOf()).toEqual(baseline)
        const gone = await caller.graphql<CompleteTaskData>("completeTask", { input: { id: taskId } })
        expect(gone.errorCode).toBe(TaskErrorCode.NotFound)

        // The session row exists while the journey uses it; sign-out must take it away.
        expect(await sessionCount()).toBe(1)
        const signedOut = await api.graphql<SignOutData>("signOut", { input: { sessionToken: person.sessionToken } })
        expect(signedOut.errors).toBeNull()
        expect(signedOut.data?.signOut.signedOut).toBe(true)
        const after = await caller.graphql<TasksData>("tasks")
        expect(after.errorCode).toBe(IdentityErrorCode.NotFound)
        expect(after.data).toBeNull()
        expect(await sessionCount()).toBe(0)
    })
})
