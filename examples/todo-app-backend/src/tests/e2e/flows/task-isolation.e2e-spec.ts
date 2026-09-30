import { randomUUID } from "node:crypto"
import { SessionErrorCode } from "@modules/domain/session"
import { TaskErrorCode } from "@modules/domain/task"
import { SESSIONS_BY_TOKENS, TASK_BY_ID } from "@tests/fixtures/persistence/e2e-verification.sql"
import type { SessionRow, TaskRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type {
    CompleteTaskData,
    CreateTaskData,
    SignOutData,
    TaskCountsData,
    TasksData,
} from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/use-test-world"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"

/**
 * br.task.single-owner end to end: two signed-in people on one api, and one person task stays invisible and untouchable to
 * the other through every door the schema offers: list, counts, complete, reopen, delete. Where the api cannot see the row
 * at all (a stranger view simply omits it), the shared entity manager is the witness: the row still sits under its owner
 * personId, untouched by the stranger refused attempts.
 */
describe("task isolation (e2e)", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true } } })

    it("two users on one api: one user task is invisible and untouchable to the other", async () => {
        const { api } = world.apps.todo
        const title = `e2e isolation ${randomUUID()}`
        const alice = await world.signedInPerson("alice")
        const bob = await world.signedInPerson("bob")
        expect(bob.personId).not.toBe(alice.personId)

        const taskIdsOf = async (caller: typeof alice.caller): Promise<Array<string>> => {
            const observed = await caller.graphql<TasksData>("tasks")
            expect(observed.errors).toBeNull()
            return observed.data?.tasks.map((task) => task.taskId) ?? []
        }
        const countsOf = async (caller: typeof alice.caller): Promise<TaskCountsData["taskCounts"] | undefined> => {
            const observed = await caller.graphql<TaskCountsData>("taskCounts")
            expect(observed.errors).toBeNull()
            return observed.data?.taskCounts
        }

        // Two live session rows, one per distinct person: the identities are real.
        const sessions: Array<SessionRow> = await world.db.primary.query(SESSIONS_BY_TOKENS, [[alice.sessionToken, bob.sessionToken]])
        expect(sessions.map((row) => row.person_id).sort()).toEqual([alice.personId, bob.personId].sort())

        const bobCountsBefore = await countsOf(bob.caller)
        const created = await alice.caller.graphql<CreateTaskData>("createTask", { input: { title } })
        expect(created.errors).toBeNull()
        const taskId = created.data?.createTask.taskId ?? ""
        expect(taskId).not.toBe("")

        // Invisible to Bob at every read door: his list omits it, his counts never move.
        expect(await taskIdsOf(alice.caller)).toContain(taskId)
        expect(await taskIdsOf(bob.caller)).not.toContain(taskId)
        expect(await countsOf(bob.caller)).toEqual(bobCountsBefore)

        // Untouchable to Bob at every write door the schema offers for a task id.
        for (const operation of ["completeTask", "reopenTask", "deleteTask"] as const) {
            const refused = await bob.caller.graphql<CompleteTaskData>(operation, { input: { id: taskId } })
            expect(refused.errorCode).toBe(TaskErrorCode.Forbidden)
            expect(refused.data).toBeNull()
        }

        // The row still exists, still owned by Alice, still open: the refusals wrote nothing.
        const untouched: Array<TaskRow> = await world.db.primary.query(TASK_BY_ID, [taskId])
        expect(untouched).toEqual([{ id: taskId, owner: alice.personId, title, complete: false, completed_at: null }])

        // Alice completes it; the boundary does not soften with the state change.
        const completed = await alice.caller.graphql<CompleteTaskData>("completeTask", { input: { id: taskId } })
        expect(completed.errors).toBeNull()
        expect(completed.data?.completeTask.complete).toBe(true)
        expect(await taskIdsOf(bob.caller)).not.toContain(taskId)
        expect(await countsOf(bob.caller)).toEqual(bobCountsBefore)
        const bobReopen = await bob.caller.graphql<CompleteTaskData>("reopenTask", { input: { id: taskId } })
        expect(bobReopen.errorCode).toBe(TaskErrorCode.Forbidden)
        const finalRows: Array<TaskRow> = await world.db.primary.query(TASK_BY_ID, [taskId])
        expect(finalRows[0]?.owner).toBe(alice.personId)
        expect(finalRows[0]?.complete).toBe(true)
        expect(finalRows[0]?.completed_at).not.toBeNull()

        // The journey ends clean: both sessions signed out, both tokens dead at the door and in the store.
        await api.graphql<SignOutData>("signOut", { input: { sessionToken: alice.sessionToken } })
        await api.graphql<SignOutData>("signOut", { input: { sessionToken: bob.sessionToken } })
        expect((await alice.caller.graphql<TasksData>("tasks")).errorCode).toBe(SessionErrorCode.NotFound)
        const remaining: Array<SessionRow> = await world.db.primary.query(SESSIONS_BY_TOKENS, [[alice.sessionToken, bob.sessionToken]])
        expect(remaining).toEqual([])
    })
})
