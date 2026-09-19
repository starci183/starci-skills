import {
    E2EWorld, bootE2EWorld 
} from "@tests/infra/e2e-world"
import {
    pollUntil 
} from "@tests/infra/e2e-poll"
import {
    E2E_BOOT_TIMEOUT_MS 
} from "@tests/infra/testing-infra.options"
import {
    E2EHttpClient 
} from "@tests/infra/integrations/http/e2e-http.service"

jest.setTimeout(300_000)

interface AuditLine {
  at: string;
  action: string;
  target: string | null;
}

const OWNER = {
    email: "demo@todo.dev", password: "todo-demo-pass" 
}

const SIGN_IN = "mutation SignIn($input: SignInInput!) { signIn(input: $input) { sessionToken personId } }"
const SIGN_OUT = "mutation SignOut($input: SignOutInput!) { signOut(input: $input) { signedOut } }"
const CREATE_TASK = "mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }"
const COMPLETE_TASK = "mutation CompleteTask($id: ID!) { completeTask(id: $id) { taskId complete } }"
const DELETE_TASK = "mutation DeleteTask($id: ID!) { deleteTask(id: $id) { deleted } }"
const AUDIT_LOG = "query { auditLog { at action target } }"
const EXPORT_MY_DATA = "query { exportMyData { at action target } }"

/** contract.audit.emitted-events' five tracked actions, as the log records them. */
const TRACKED_ACTIONS = ["login.signed-in",
    "login.signed-out",
    "task.created",
    "task.completed",
    "task.deleted"]
/** The `iv.tag.ciphertext` shape a sealed actor keeps - the plaintext personId must never appear. */
const SEALED_BLOB = /^[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}$/

interface KeyRow {
  key_id: string;
}
interface ChainRow {
  id: string;
  prev_hash: string;
  hash: string;
}
interface StoredLine {
  action: string;
  target: string | null;
  actor: string;
}

/**
 * fr.audit.log.append + fr.audit.export + fr.audit.log.read as one A->Z journey: tracked actions
 * through the public doors emit audit lines off the event bus, the subject's export returns those
 * same lines decrypted, and the auditLog read agrees with the export line-for-line. The postgres
 * reads are out-of-band verification only: every stored actor stays sealed and the hash chain the
 * lines were appended into is recomputed link by link.
 */
describe("export-and-log (e2e)",
    () => {
        let world: E2EWorld

        beforeAll(async () => {
            world = await bootE2EWorld()
            const health = await world.http.client().get<{ status: string }>("/health")
            expect(health.data.status).toBe("ok")
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            await world.moduleRef.close()
        })

        it("tracked activity -> audit lines appended -> exportMyData returns them -> auditLog agrees",
            async () => {
                const {
                    http, auth, dataSource 
                } = world
                const marker = `e2e-export-${Date.now()}`
                const owner = await auth.signIn(OWNER.email,
                    OWNER.password)
                const asOwner: E2EHttpClient = http.client({
                    bearerToken: owner.sessionToken 
                })

                // The task lifecycle through the public doors.
                const created = await asOwner.graphql<{ createTask: { taskId: string } }>(CREATE_TASK,
                    {
                        input: {
                            title: marker 
                        },
                    })
                expect(created.errorCode).toBeNull()
                const taskId = created.data!.createTask.taskId
                const done = await asOwner.graphql(COMPLETE_TASK,
                    {
                        id: taskId 
                    })
                expect(done.errorCode).toBeNull()
                const removed = await asOwner.graphql(DELETE_TASK,
                    {
                        id: taskId 
                    })
                expect(removed.errorCode).toBeNull()

                // A second session signed in and back out through the door, so both login actions land while
                // the primary session stays alive for the reads below.
                const anonymous = http.client()
                const second = await anonymous.graphql<{ signIn: { sessionToken: string } }>(SIGN_IN,
                    {
                        input: OWNER 
                    })
                expect(second.errorCode).toBeNull()
                const signedOut = await anonymous.graphql<{ signOut: { signedOut: boolean } }>(SIGN_OUT,
                    {
                        input: {
                            sessionToken: second.data!.signIn.sessionToken 
                        },
                    })
                expect(signedOut.errorCode).toBeNull()
                expect(signedOut.data!.signOut.signedOut).toBe(true)

                // The append path is asynchronous (AuditEventSubscriber -> AppendLogLineCommand): poll the
                // public read until every tracked action shows up as a line.
                const lines = await pollUntil("all tracked actions visible in auditLog",
                    async () => {
                        const res = await asOwner.graphql<{ auditLog: Array<AuditLine> }>(AUDIT_LOG)
                        const read = res.data?.auditLog ?? null
                        return (read && TRACKED_ACTIONS.every((action) => read.some((line) => line.action === action)) && read) || null
                    },
                    90_000,
                    1_500)
                expect(lines.filter((line) => line.action === "task.created" && line.target === taskId)).toHaveLength(1)
                expect(lines.filter((line) => line.action === "task.completed" && line.target === taskId)).toHaveLength(1)
                expect(lines.filter((line) => line.action === "task.deleted" && line.target === taskId)).toHaveLength(1)

                // The export door resolves the same per-person lines as the log read - identical, ordered set.
                const exported = await asOwner.graphql<{ exportMyData: Array<AuditLine> }>(EXPORT_MY_DATA)
                expect(exported.errorCode).toBeNull()
                expect(exported.data!.exportMyData).toEqual(lines)

                // The response type is the boundary: three fields, never an actor, a keyId or a chain position.
                for (const line of lines) {
                    expect(Object.keys(line).sort()).toEqual(["action",
                        "at",
                        "target"])
                    expect(new Date(line.at).getTime()).not.toBeNaN()
                }
                const serialized = JSON.stringify(lines)
                expect(serialized).not.toMatch(SEALED_BLOB)
                expect(serialized.toLowerCase()).not.toContain("keyid")
                expect(serialized.toLowerCase()).not.toContain("prevhash")

                // Out-of-band: every line the door returned exists as a stored row under the subject's keyId,
                // with the actor sealed and action/target in the clear exactly as the door reported them.
                const keys = await dataSource.query<Array<KeyRow>>("SELECT key_id FROM audit_keys WHERE person_id = $1",
                    [owner.personId])
                expect(keys).toHaveLength(1)
                const stored = await dataSource.query<Array<StoredLine>>(
                    "SELECT action, target, actor FROM audit_log_lines WHERE key_id = $1 ORDER BY id",
                    [keys[0].key_id],
                )
                expect(stored).toHaveLength(lines.length)
                expect(stored.map((line) => ({
                    action: line.action, target: line.target 
                }))).toEqual(
                    lines.map((line) => ({
                        action: line.action, target: line.target 
                    })),
                )
                for (const line of stored) {
                    expect(line.actor).toMatch(SEALED_BLOB)
                    expect(line.actor).not.toContain(owner.personId)
                }

                // Append-only means chain-consistent: recompute the linkage across the whole table, which on
                // this run-owned stack also contains the system actor's lines.
                const chain = await dataSource.query<Array<ChainRow>>("SELECT id, prev_hash, hash FROM audit_log_lines ORDER BY id")
                expect(chain.length).toBeGreaterThanOrEqual(stored.length)
                expect(chain[0].prev_hash).toBe("GENESIS")
                for (let i = 1; i < chain.length; i++) {
                    expect(chain[i].prev_hash).toBe(chain[i - 1].hash)
                }
            })
    })
