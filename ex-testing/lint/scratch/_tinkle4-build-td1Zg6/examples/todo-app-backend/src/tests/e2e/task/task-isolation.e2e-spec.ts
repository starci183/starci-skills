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

interface SessionRow {
  token: string;
  person_id: string;
}

/**
 * br.task.single-owner end to end: two signed-in people on one stack, and one person's task
 * stays invisible and untouchable to the other through every door the schema offers - list,
 * counts, complete, reopen, delete. Where the API cannot see the row at all (a stranger's view
 * simply omits it), Postgres is the out-of-band witness: the row still sits under its owner's
 * personId, untouched by the stranger's refused attempts.
 */
describe("task isolation (e2e)",
    () => {
        let world: E2EWorld

        beforeAll(async () => {
            world = await bootE2EWorld()
            expect((await world.http.anonymous().get<{ status: string }>("/health")).data.status).toBe("ok")
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            // close() runs the stack's teardown: compose down -v plus the verified-gone check, which
            // throws here if any container or volume of this run's project remains.
            await world.moduleRef.close()
        })

        it("two users on one stack: one user's task is invisible and untouchable to the other",
            async () => {
                const {
                    http, auth, dataSource 
                } = world
                const title = `e2e isolation ${Date.now()}`

                // The two identities the realm import seeds, each signed in through the public door.
                const alice = await auth.persona("owner")
                const bob = await auth.persona("other")
                expect(bob.personId).not.toBe(alice.personId)

                const tasksOf = async (token: string): Promise<Array<TaskSummary>> => {
                    const res = await http.graphql<{ tasks: Array<TaskSummary> }>("listTasks",
                        {
                            token 
                        })
                    expect(res.errors).toBeNull()
                    return res.data!.tasks
                }
                const countsOf = async (token: string): Promise<TaskCounts> => {
                    const res = await http.graphql<{ taskCounts: TaskCounts }>(TASK_COUNTS,
                        {
                            token 
                        })
                    expect(res.errors).toBeNull()
                    return res.data!.taskCounts
                }

                // Out-of-band: two live session rows, one per distinct person - the identities are real.
                const sessions = await dataSource.query<Array<SessionRow>>(
                    "SELECT token, person_id FROM sessions WHERE token = ANY($1)",
                    [[alice.token,
                        bob.token]],
                )
                expect(sessions).toHaveLength(2)
                expect(sessions.map((row) => row.person_id).sort()).toEqual([alice.personId,
                    bob.personId].sort())

                const bobCountsBefore = await countsOf(bob.token)

                const created = await http.graphql<{ createTask: { taskId: string; title: string } }>(
                    "createTask",
                    {
                        variables: {
                            input: {
                                title 
                            } 
                        }, token: alice.token 
                    },
                )
                expect(created.errors).toBeNull()
                const taskId = created.data!.createTask.taskId

                // Invisible to Bob at every read door: his list omits it, his counts never move.
                expect((await tasksOf(alice.token)).map((task) => task.taskId)).toContain(taskId)
                expect((await tasksOf(bob.token)).map((task) => task.taskId)).not.toContain(taskId)
                expect(await countsOf(bob.token)).toEqual(bobCountsBefore)

                // Untouchable to Bob at every write door the schema offers for a task id.
                for (const document of ["completeTask",
                    "reopenTask",
                    "deleteTask"] as const) {
                    const refused = await http.graphql(document,
                        {
                            variables: {
                                id: taskId 
                            }, token: bob.token 
                        })
                    expect(refused.errorCode).toBe("TASK_FORBIDDEN")
                    expect(refused.data).toBeNull()
                }

                // Out-of-band: the row still exists, still Alice's, still open - the refusals wrote nothing.
                const afterRefusals = await dataSource.query<Array<TaskRow>>(
                    "SELECT id, owner, title, complete, completed_at FROM tasks WHERE id = $1",
                    [taskId],
                )
                expect(afterRefusals).toEqual([
                    {
                        id: taskId, owner: alice.personId, title, complete: false, completed_at: null 
                    },
                ])

                // Alice completes it; the boundary does not soften with the state change.
                const completed = await http.graphql<{ completeTask: { taskId: string; complete: boolean } }>(
                    "completeTask",
                    {
                        variables: {
                            id: taskId 
                        }, token: alice.token 
                    },
                )
                expect(completed.errors).toBeNull()
                expect(completed.data!.completeTask.complete).toBe(true)
                expect((await tasksOf(bob.token)).map((task) => task.taskId)).not.toContain(taskId)
                expect(await countsOf(bob.token)).toEqual(bobCountsBefore)
                const bobReopen = await http.graphql("reopenTask",
                    {
                        variables: {
                            id: taskId 
                        }, token: bob.token 
                    })
                expect(bobReopen.errorCode).toBe("TASK_FORBIDDEN")

                const finalRows = await dataSource.query<Array<TaskRow>>(
                    "SELECT owner, complete, completed_at FROM tasks WHERE id = $1",
                    [taskId],
                )
                expect(finalRows[0].owner).toBe(alice.personId)
                expect(finalRows[0].complete).toBe(true)
                expect(finalRows[0].completed_at).not.toBeNull()

                // Journey ends clean: both sessions signed out, both tokens dead at the door and in the store.
                for (const session of [alice,
                    bob]) {
                    const out = await http.graphql<{ signOut: { signedOut: boolean } }>("signOut",
                        {
                            variables: {
                                input: {
                                    sessionToken: session.token 
                                } 
                            },
                        })
                    expect(out.errors).toBeNull()
                    expect(out.data!.signOut.signedOut).toBe(true)
                }
                expect((await http.graphql("listTasks",
                    {
                        token: alice.token 
                    })).errorCode).toBe("SESSION_NOT_FOUND")
                const remaining = await dataSource.query<Array<SessionRow>>("SELECT token FROM sessions WHERE token = ANY($1)",
                    [
                        [alice.token,
                            bob.token],
                    ])
                expect(remaining).toHaveLength(0)
            })
    })
