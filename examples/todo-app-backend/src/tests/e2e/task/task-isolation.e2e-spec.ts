import { randomUUID } from "node:crypto"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import type { E2EGraphqlHandle } from "../setup/e2e-graphql.client"
import { present } from "../setup/e2e.error"
import type { CompleteTaskData, CreateTaskData, TaskCountsData, TasksData } from "../setup/e2e-views.contracts"

/**
 * br.task.single-owner end to end: two signed-in people on one stack, and one person task stays invisible and
 * untouchable to the other through every door the schema offers: list, counts, complete, reopen, delete. Where the api
 * cannot see the row at all (a stranger view simply omits it), Postgres is the out-of-band witness: the row still sits
 * under its owner personId, untouched by the stranger refused attempts.
 */
describe("task isolation (e2e)", () => {
    let world: E2EWorld

    beforeAll(async () => {
        world = await bootE2eWorld("task/task-isolation")
        expect((await world.http().get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 600_000)

    afterAll(async () => {
        // close() runs the stack teardown: compose down -v plus the verified-gone check.
        await world.close()
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("two users on one stack: one user task is invisible and untouchable to the other", async () => {
        const { graphql, auth, database } = world
        const title = `e2e isolation ${randomUUID()}`
        // The two identities the realm import seeds, each signed in through the public door.
        const alice = await auth.persona("owner")
        const bob = await auth.persona("other")
        expect(bob.personId).not.toBe(alice.personId)
        const asAlice = graphql.client(alice.sessionToken)
        const asBob = graphql.client(bob.sessionToken)

        const taskIdsOf = async (caller: E2EGraphqlHandle): Promise<Array<string>> => {
            const observed = await caller.read<TasksData>("tasks")
            expect(observed.errors).toBeNull()
            return present(observed.data, "tasks data").tasks.map((task) => task.taskId)
        }
        const countsOf = async (caller: E2EGraphqlHandle): Promise<TaskCountsData["taskCounts"]> => {
            const observed = await caller.read<TaskCountsData>("taskCounts")
            expect(observed.errors).toBeNull()
            return present(observed.data, "taskCounts data").taskCounts
        }

        // Out-of-band: two live session rows, one per distinct person: the identities are real.
        const sessions = await database.sessionsByTokens([alice.sessionToken, bob.sessionToken])
        expect(sessions.map((row) => row.person_id).sort()).toEqual([alice.personId, bob.personId].sort())

        const bobCountsBefore = await countsOf(asBob)
        const created = await asAlice.mutate<CreateTaskData>("createTask", { variables: { input: { title } } })
        expect(created.errors).toBeNull()
        const taskId = present(created.data, "createTask data").createTask.taskId

        // Invisible to Bob at every read door: his list omits it, his counts never move.
        expect(await taskIdsOf(asAlice)).toContain(taskId)
        expect(await taskIdsOf(asBob)).not.toContain(taskId)
        expect(await countsOf(asBob)).toEqual(bobCountsBefore)

        // Untouchable to Bob at every write door the schema offers for a task id.
        for (const document of ["completeTask", "reopenTask", "deleteTask"]) {
            const refused = await asBob.mutate<CompleteTaskData>(document, { variables: { input: { id: taskId } } })
            expect(refused.errorCode).toBe("TASK_FORBIDDEN")
            expect(refused.data).toBeNull()
        }

        // Out-of-band: the row still exists, still owned by Alice, still open: the refusals wrote nothing.
        expect(await database.taskById(taskId)).toEqual([{ id: taskId, owner: alice.personId, title, complete: false, completed_at: null }])

        // Alice completes it; the boundary does not soften with the state change.
        const completed = await asAlice.mutate<CompleteTaskData>("completeTask", { variables: { input: { id: taskId } } })
        expect(completed.errors).toBeNull()
        expect(completed.data?.completeTask.complete).toBe(true)
        expect(await taskIdsOf(asBob)).not.toContain(taskId)
        expect(await countsOf(asBob)).toEqual(bobCountsBefore)
        const bobReopen = await asBob.mutate<CompleteTaskData>("reopenTask", { variables: { input: { id: taskId } } })
        expect(bobReopen.errorCode).toBe("TASK_FORBIDDEN")
        const finalRows = await database.taskById(taskId)
        expect(finalRows[0]?.owner).toBe(alice.personId)
        expect(finalRows[0]?.complete).toBe(true)
        expect(finalRows[0]?.completed_at).not.toBeNull()

        // The journey ends clean: both sessions signed out, both tokens dead at the door and in the store.
        await auth.signOut(alice.sessionToken)
        await auth.signOut(bob.sessionToken)
        expect((await asAlice.read<TasksData>("tasks")).errorCode).toBe("SESSION_NOT_FOUND")
        expect(await database.sessionsByTokens([alice.sessionToken, bob.sessionToken])).toEqual([])
    })
})
