import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    E2E_BOOT_TIMEOUT_MS 
} from "@tests/infra/testing-infra.options"

jest.setTimeout(120_000)

// taskCounts has no GRAPHQL_DOCUMENTS entry yet - the registry names only the doors the retired
// JS harness exercised; a raw document string is the supported escape hatch for the rest.
const TASK_COUNTS = "query TaskCounts { taskCounts { open complete } }"

// The run-owned realm seeds this identity (.starcistacks/dev/infra/compose/realm-todo.json).
const DEMO = {
    email: "demo@todo.dev", password: "todo-demo-pass" 
}

interface TaskSummary {
  taskId: string;
  title: string;
  complete: boolean;
}

interface TaskCounts {
  open: number;
  complete: number;
}

interface TaskRow {
  id: string;
  owner: string;
  title: string;
  complete: boolean;
  completed_at: Date | null;
}

interface CountRow {
  count: number;
}

/**
 * fr.task.* as one A->Z journey over the real stack: sign in, create a task, read it back out
 * of the list, complete it, reopen it, watch taskCounts track each transition, then sign out
 * and find the door closed. The Postgres reads are out-of-band verification only - every step
 * of the journey itself travels the real /graphql door.
 */
describe("task lifecycle (e2e)",
    () => {
        let world: E2EWorld

        beforeAll(async () => {
            world = await bootE2EWorld()
            // The stack counts as up only when the api answers its dependency-checked /health.
            expect((await world.http.anonymous().get<{ status: string }>("/health")).data.status).toBe("ok")
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            // close() runs the stack's teardown: compose down -v plus the verified-gone check, which
            // throws here if any container or volume of this run's project remains.
            await world.moduleRef.close()
        })

        it("sign-in → create → list → complete → reopen → counts → sign-out",
            async () => {
                const {
                    http, auth, dataSource 
                } = world
                const title = `e2e lifecycle ${Date.now()}`
                const session = await auth.signIn(DEMO.email,
                    DEMO.password)
                const token = session.token
                const personId = session.personId

                const countsOf = async (): Promise<TaskCounts> => {
                    const res = await http.graphql<{ taskCounts: TaskCounts }>(TASK_COUNTS,
                        {
                            token 
                        })
                    expect(res.errors).toBeNull()
                    return res.data!.taskCounts
                }
                const baseline = await countsOf()

                const created = await http.graphql<{ createTask: { taskId: string; title: string } }>(
                    "createTask",
                    {
                        variables: {
                            input: {
                                title 
                            } 
                        }, token 
                    },
                )
                expect(created.errors).toBeNull()
                const taskId = created.data!.createTask.taskId
                expect(taskId).toEqual(expect.any(String))
                expect(created.data!.createTask.title).toBe(title)

                // There is no single-task query in this schema: a task is read back out of its owner's list.
                const listed = await http.graphql<{ tasks: Array<TaskSummary> }>("listTasks",
                    {
                        token 
                    })
                expect(listed.errors).toBeNull()
                expect(listed.data!.tasks.find((task) => task.taskId === taskId)).toEqual({
                    taskId,
                    title,
                    complete: false,
                })
                expect(await countsOf()).toEqual({
                    open: baseline.open + 1, complete: baseline.complete 
                })

                const completed = await http.graphql<{ completeTask: { taskId: string; complete: boolean } }>(
                    "completeTask",
                    {
                        variables: {
                            id: taskId 
                        }, token 
                    },
                )
                expect(completed.errors).toBeNull()
                expect(completed.data!.completeTask).toEqual({
                    taskId, complete: true 
                })
                expect(await countsOf()).toEqual({
                    open: baseline.open, complete: baseline.complete + 1 
                })

                // Out-of-band: the row itself carries the owner, the flag and a real completed_at.
                const doneRows = await dataSource.query<Array<TaskRow>>(
                    "SELECT id, owner, title, complete, completed_at FROM tasks WHERE id = $1",
                    [taskId],
                )
                expect(doneRows).toHaveLength(1)
                expect(doneRows[0]).toMatchObject({
                    id: taskId, owner: personId, title, complete: true 
                })
                expect(doneRows[0].completed_at).not.toBeNull()

                const reopened = await http.graphql<{ reopenTask: { taskId: string; complete: boolean } }>(
                    "reopenTask",
                    {
                        variables: {
                            id: taskId 
                        }, token 
                    },
                )
                expect(reopened.errors).toBeNull()
                expect(reopened.data!.reopenTask).toEqual({
                    taskId, complete: false 
                })
                expect(await countsOf()).toEqual({
                    open: baseline.open + 1, complete: baseline.complete 
                })

                const relisted = await http.graphql<{ tasks: Array<TaskSummary> }>("listTasks",
                    {
                        token 
                    })
                expect(relisted.data!.tasks.find((task) => task.taskId === taskId)).toEqual({
                    taskId,
                    title,
                    complete: false,
                })
                const reopenedRows = await dataSource.query<Array<TaskRow>>(
                    "SELECT complete, completed_at FROM tasks WHERE id = $1",
                    [taskId],
                )
                expect(reopenedRows[0].complete).toBe(false)
                expect(reopenedRows[0].completed_at).toBeNull()

                // The session row exists while the journey uses it; sign-out must take it away.
                const liveSessions = await dataSource.query<Array<CountRow>>(
                    "SELECT COUNT(*)::int AS count FROM sessions WHERE token = $1",
                    [token],
                )
                expect(liveSessions[0].count).toBe(1)

                const signedOut = await http.graphql<{ signOut: { signedOut: boolean } }>("signOut",
                    {
                        variables: {
                            input: {
                                sessionToken: token 
                            } 
                        },
                    })
                expect(signedOut.errors).toBeNull()
                expect(signedOut.data!.signOut.signedOut).toBe(true)

                const after = await http.graphql<{ tasks: Array<TaskSummary> }>("listTasks",
                    {
                        token 
                    })
                expect(after.errorCode).toBe("SESSION_NOT_FOUND")
                expect(after.data).toBeNull()
                const deadSessions = await dataSource.query<Array<CountRow>>(
                    "SELECT COUNT(*)::int AS count FROM sessions WHERE token = $1",
                    [token],
                )
                expect(deadSessions[0].count).toBe(0)
            })
    })
