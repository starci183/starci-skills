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

const CREATE_TASK = "mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { taskId title } }"
const AUDIT_LOG = "query { auditLog { at action target } }"
const EXPORT_MY_DATA = "query { exportMyData { at action target } }"
const REQUEST_ERASURE = "mutation { requestErasure { requestId state } }"
const COMPLETE_ERASURE = "mutation CompleteErasure($requestId: ID!) { completeErasure(requestId: $requestId) { requestId state } }"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
/** The `iv.tag.ciphertext` shape a sealed actor keeps - the plaintext personId must never appear. */
const SEALED_BLOB = /^[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}$/

interface KeyRow {
  person_id: string;
  key_id: string;
}
interface ErasureRow {
  request_id: string;
  person_id: string | null;
  state: string;
  verified_at: string | null;
  executing_at: string | null;
  completed_at: string | null;
}
interface CountRow {
  count: number;
}
interface StoredLine {
  action: string;
  target: string | null;
  key_id: string;
  actor: string;
}

/**
 * fr.audit.erasure.request + fr.audit.erasure.complete as one A->Z journey: the subject produces
 * readable audit lines, requests erasure (tRequest chains tVerify on the same caller), completes
 * it (tExecute crypto-shreds the key, tComplete scrubs person_id), and both transitions leave
 * system-actor lines naming only the requestId. Reads happen through the public door; the
 * postgres reads are out-of-band verification of the anonymization, never a shortcut around it.
 * The subject is a throwaway realm account, not a seeded persona: a completed erasure destroys
 * that identity's audit key for the rest of this stack's lifetime, so demo is only ever the
 * control reader.
 */
describe("erasure journey (e2e)",
    () => {
        let world: E2EWorld
        let subjectPersonId = ""

        beforeAll(async () => {
            world = await bootE2EWorld()
            const health = await world.http.client().get<{ status: string }>("/health")
            expect(health.data.status).toBe("ok")
        },
        E2E_BOOT_TIMEOUT_MS)

        afterAll(async () => {
            if (subjectPersonId) await world.auth.deleteAccount(subjectPersonId)
            await world.moduleRef.close()
        })

        it("request-erasure -> verified row -> complete-erasure -> subject anonymized (api + db) -> system lines appended",
            async () => {
                const {
                    http, auth, dataSource 
                } = world
                const marker = `e2e-erasure-${Date.now()}`
                const subjectEmail = `${marker}@todo.dev`
                const subjectPassword = "e2e-erasure-pass"
                const createdAccount = await auth.createAccount({
                    email: subjectEmail, password: subjectPassword 
                })
                subjectPersonId = createdAccount.personId
                const subject = await auth.signIn(subjectEmail,
                    subjectPassword)
                expect(subject.personId).toBe(subjectPersonId)
                const owner = await auth.signIn(OWNER.email,
                    OWNER.password)
                const asSubject: E2EHttpClient = http.client({
                    bearerToken: subject.sessionToken 
                })
                const asOwner: E2EHttpClient = http.client({
                    bearerToken: owner.sessionToken 
                })

                // Activity that must become unreadable: one task by the future subject, one by the control.
                const created = await asSubject.graphql<{ createTask: { taskId: string } }>(CREATE_TASK,
                    {
                        input: {
                            title: `${marker}-subject` 
                        },
                    })
                expect(created.errorCode).toBeNull()
                const subjectTaskId = created.data!.createTask.taskId
                const ownerCreated = await asOwner.graphql<{ createTask: { taskId: string } }>(CREATE_TASK,
                    {
                        input: {
                            title: `${marker}-owner` 
                        },
                    })
                expect(ownerCreated.errorCode).toBeNull()
                const ownerTaskId = ownerCreated.data!.createTask.taskId

                // Wait for the subject's line to be readable through the door before requesting erasure -
                // the event bus feeds the audit log asynchronously (AuditEventSubscriber ->
                // AppendLogLineCommand), so a response can beat the line it triggered.
                const beforeExport = await pollUntil("subject's audit line readable through the door",
                    async () => {
                        const res = await asSubject.graphql<{ exportMyData: Array<AuditLine> }>(EXPORT_MY_DATA)
                        const lines = res.data?.exportMyData ?? null
                        return (lines?.some((line) => line.target === subjectTaskId) && lines) || null
                    },
                    90_000,
                    1_500)
                expect(beforeExport.some((line) => line.action === "task.created" && line.target === subjectTaskId)).toBe(true)

                // Out-of-band: the subject's sealing key exists, so their lines are readable today.
                const keysBefore = await dataSource.query<Array<KeyRow>>("SELECT person_id, key_id FROM audit_keys WHERE person_id = $1",
                    [
                        subject.personId,
                    ])
                expect(keysBefore).toHaveLength(1)
                const subjectKeyId = keysBefore[0].key_id
                const subjectLinesBefore = await dataSource.query<Array<CountRow>>(
                    "SELECT COUNT(*)::int AS count FROM audit_log_lines WHERE key_id = $1",
                    [subjectKeyId],
                )
                expect(subjectLinesBefore[0].count).toBeGreaterThan(0)

                // tRequest + tVerify: the door returns the already-verified request.
                const requested = await asSubject.graphql<{ requestErasure: { requestId: string; state: string } }>(REQUEST_ERASURE)
                expect(requested.errorCode).toBeNull()
                const requestId = requested.data!.requestErasure.requestId
                expect(requestId).toMatch(UUID)
                expect(requested.data!.requestErasure.state).toBe("verified")

                const requestedRow = await dataSource.query<Array<ErasureRow>>(
                    "SELECT request_id, person_id, state, verified_at::text, executing_at::text, completed_at::text FROM audit_erasure_requests WHERE request_id = $1",
                    [requestId],
                )
                expect(requestedRow).toHaveLength(1)
                expect(requestedRow[0].state).toBe("verified")
                expect(requestedRow[0].person_id).toBe(subject.personId)
                expect(requestedRow[0].verified_at).not.toBeNull()

                // tExecute destroys the key, then tComplete flips state and drops person_id.
                const completed = await asSubject.graphql<{ completeErasure: { requestId: string; state: string } }>(
                    COMPLETE_ERASURE,
                    {
                        requestId 
                    },
                )
                expect(completed.errorCode).toBeNull()
                expect(completed.data!.completeErasure).toEqual({
                    requestId, state: "complete" 
                })

                // Anonymized through the API: both of the subject's own reads now return nothing.
                const exportAfter = await asSubject.graphql<{ exportMyData: Array<AuditLine> }>(EXPORT_MY_DATA)
                const logAfter = await asSubject.graphql<{ auditLog: Array<AuditLine> }>(AUDIT_LOG)
                expect(exportAfter.errorCode).toBeNull()
                expect(logAfter.errorCode).toBeNull()
                expect(exportAfter.data!.exportMyData).toEqual([])
                expect(logAfter.data!.auditLog).toEqual([])

                // Anonymized out-of-band: the key row and the person_id on the request are both gone.
                const keysAfter = await dataSource.query<Array<KeyRow>>(
                    "SELECT person_id, key_id FROM audit_keys WHERE person_id = $1 OR key_id = $2",
                    [subject.personId,
                        subjectKeyId],
                )
                expect(keysAfter).toEqual([])
                const completedRow = await dataSource.query<Array<ErasureRow>>(
                    "SELECT request_id, person_id, state, verified_at::text, executing_at::text, completed_at::text FROM audit_erasure_requests WHERE request_id = $1",
                    [requestId],
                )
                expect(completedRow[0].state).toBe("complete")
                expect(completedRow[0].person_id).toBeNull()
                expect(completedRow[0].executing_at).not.toBeNull()
                expect(completedRow[0].completed_at).not.toBeNull()

                // Crypto-shred, not deletion: the subject's stored lines survive untouched under the orphaned
                // keyId, each actor still a sealed blob that no longer resolves to anyone.
                const subjectLinesAfter = await dataSource.query<Array<CountRow>>(
                    "SELECT COUNT(*)::int AS count FROM audit_log_lines WHERE key_id = $1",
                    [subjectKeyId],
                )
                expect(subjectLinesAfter[0].count).toBe(subjectLinesBefore[0].count)
                const orphaned = await dataSource.query<Array<StoredLine>>(
                    "SELECT action, target, key_id, actor FROM audit_log_lines WHERE key_id = $1",
                    [subjectKeyId],
                )
                for (const line of orphaned) {
                    expect(line.actor).toMatch(SEALED_BLOB)
                    expect(line.actor).not.toContain(subject.personId)
                }

                // br.audit.erasure.logged: both transitions appended lines naming the requestId, sealed under
                // the system key - which survives, so the audit trail itself never orphans.
                const systemLines = await dataSource.query<Array<StoredLine>>(
                    `SELECT action, target, key_id, actor FROM audit_log_lines
       WHERE action IN ('audit.erasure.requested', 'audit.erasure.completed') AND target = $1 ORDER BY id`,
                    [requestId],
                )
                expect(systemLines.map((line) => line.action)).toEqual(["audit.erasure.requested",
                    "audit.erasure.completed"])
                const systemKey = await dataSource.query<Array<KeyRow>>("SELECT person_id, key_id FROM audit_keys WHERE key_id = $1",
                    [
                        systemLines[0].key_id,
                    ])
                expect(systemKey).toEqual([{
                    person_id: "system", key_id: systemLines[0].key_id 
                }])

                // The control is untouched: the owner still reads their own line and never the erased subject's.
                const ownerExport = await asOwner.graphql<{ exportMyData: Array<AuditLine> }>(EXPORT_MY_DATA)
                const ownerTargets = ownerExport.data!.exportMyData.map((line) => line.target).filter(Boolean)
                expect(ownerTargets).toContain(ownerTaskId)
                expect(ownerTargets).not.toContain(subjectTaskId)
            })
    })
