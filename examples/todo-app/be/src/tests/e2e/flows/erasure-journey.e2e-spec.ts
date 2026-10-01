import { randomUUID } from "node:crypto"
import {
    AUDIT_ERASURE_LINES_OF_REQUEST,
    AUDIT_ERASURE_REQUEST,
    AUDIT_KEY_BY_ID,
    AUDIT_KEYS_OF_PERSON,
    AUDIT_KEYS_OF_PERSON_OR_KEY,
    AUDIT_LINE_COUNT_UNDER_KEY,
    AUDIT_LINES_UNDER_KEY,
} from "@tests/fixtures/persistence/e2e-verification.sql"
import type {
    AuditKeyRow,
    AuditLineRow,
    CountRow,
    ErasureRequestRow,
} from "@tests/fixtures/persistence/e2e-verification.rows"
import type {
    AuditLineEntry,
    AuditLogData,
    CompleteErasureData,
    CreateTaskData,
    ExportMyDataData,
    RequestErasureData,
} from "@tests/fixtures/views/e2e-views.contracts"
import type { TestCaller } from "@starci/test-world"
import { useTestWorld } from "@tests/world/use-test-world"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The `iv.tag.ciphertext` shape a sealed actor keeps: the plaintext personId must never appear. */
const SEALED_BLOB = /^[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}$/

/**
 * fr.audit.erasure.request + fr.audit.erasure.complete as one A->Z journey: the subject produces readable audit lines
 * (asynchronously, through the outbox and the worker), requests erasure (the request is verified in the same step), completes
 * it (the subject key is crypto-shredded and person_id scrubbed), and both transitions leave system-actor lines naming only
 * the requestId. Reads happen through the public doors; the stored rows read through the shared entity manager verify the
 * anonymization, never shortcut it. The subject is a fresh person and a completed erasure destroys that person audit key,
 * so a second person is only ever the control reader.
 */
describe("erasure journey (e2e)", () => {
    const world = useTestWorld({ apps: ["todo", "worker"] })

    const exportedLines = async (caller: TestCaller): Promise<ReadonlyArray<AuditLineEntry>> => {
        const observed = await caller.graphql<ExportMyDataData>("exportMyData")
        return observed.data?.exportMyData ?? []
    }

    const lineCountUnderKey = async (keyId: string): Promise<number> => {
        const [row]: Array<CountRow> = await world.db.primary.query(AUDIT_LINE_COUNT_UNDER_KEY, [keyId])
        return row?.count ?? 0
    }

    it("request-erasure -> verified row -> complete-erasure -> subject anonymized (api + db) -> system lines appended", async () => {
        const marker = `e2e-erasure-${randomUUID()}`
        const subject = await world.signedInPerson("erasure-subject")
        const control = await world.signedInPerson("erasure-control")
        const asSubject = subject.caller
        const asControl = control.caller

        // Activity that must become unreadable: one task by the future subject, one by the control.
        const subjectTask = await asSubject.graphql<CreateTaskData>("createTask", {
            input: { title: `${marker}-subject` },
        })
        expect(subjectTask.errorCode).toBeNull()
        const subjectTaskId = subjectTask.data?.createTask.taskId ?? ""
        const controlTask = await asControl.graphql<CreateTaskData>("createTask", {
            input: { title: `${marker}-control` },
        })
        expect(controlTask.errorCode).toBeNull()
        const controlTaskId = controlTask.data?.createTask.taskId ?? ""

        // The audit line is appended asynchronously (outbox message, then the worker consumer), so a response can beat the
        // line it triggered: wait until both of the subject lines (sign-in and task creation) are readable through the door.
        const beforeExport = await world.waitUntil(
            "the audit lines of the subject readable through the door",
            () => exportedLines(asSubject),
            (lines) =>
                lines.some((line) => line.action === "task.created" && line.target === subjectTaskId) &&
                lines.some((line) => line.action === "login.signed-in"),
            { timeoutMs: 90_000, intervalMs: 1_000 },
        )
        expect(beforeExport.length).toBeGreaterThanOrEqual(2)

        // The subject sealing key exists, so their lines are readable today.
        const keysBefore: Array<AuditKeyRow> = await world.db.primary.query(AUDIT_KEYS_OF_PERSON, [subject.personId])
        expect(keysBefore).toHaveLength(1)
        const subjectKeyId = keysBefore[0]?.key_id ?? ""
        expect(await lineCountUnderKey(subjectKeyId)).toBe(beforeExport.length)

        // Request and verify: the door returns the already-verified request.
        const requested = await asSubject.graphql<RequestErasureData>("requestErasure")
        expect(requested.errorCode).toBeNull()
        const request = requested.data?.requestErasure
        const requestId = request?.requestId ?? ""
        expect(requestId).toMatch(UUID)
        expect(request?.state).toBe("verified")
        const requestedRow: Array<ErasureRequestRow> = await world.db.primary.query(AUDIT_ERASURE_REQUEST, [requestId])
        expect(requestedRow).toHaveLength(1)
        expect(requestedRow[0]?.state).toBe("verified")
        expect(requestedRow[0]?.person_id).toBe(subject.personId)
        expect(requestedRow[0]?.verified_at).not.toBeNull()

        // Execute: the key is destroyed, then the state flips and person_id is dropped.
        const completed = await asSubject.graphql<CompleteErasureData>("completeErasure", { input: { requestId } })
        expect(completed.errorCode).toBeNull()
        expect(completed.data?.completeErasure).toEqual({ requestId, state: "complete" })

        // Anonymized through the api: both of the subject own reads now return nothing.
        const exportAfter = await asSubject.graphql<ExportMyDataData>("exportMyData")
        const logAfter = await asSubject.graphql<AuditLogData>("auditLog")
        expect(exportAfter.errorCode).toBeNull()
        expect(logAfter.errorCode).toBeNull()
        expect(exportAfter.data?.exportMyData).toEqual([])
        expect(logAfter.data?.auditLog).toEqual([])

        // Anonymized in the store: the key row and the person_id on the request are both gone.
        const survivingKeys: Array<AuditKeyRow> = await world.db.primary.query(AUDIT_KEYS_OF_PERSON_OR_KEY, [
            subject.personId,
            subjectKeyId,
        ])
        expect(survivingKeys).toEqual([])
        const completedRow: Array<ErasureRequestRow> = await world.db.primary.query(AUDIT_ERASURE_REQUEST, [requestId])
        expect(completedRow[0]?.state).toBe("complete")
        expect(completedRow[0]?.person_id).toBeNull()
        expect(completedRow[0]?.executing_at).not.toBeNull()
        expect(completedRow[0]?.completed_at).not.toBeNull()

        // Crypto-shred, not deletion: the stored lines of the subject survive untouched under the orphaned key id, each
        // actor still a sealed blob that no longer resolves to anyone.
        expect(await lineCountUnderKey(subjectKeyId)).toBe(beforeExport.length)
        const orphaned: Array<AuditLineRow> = await world.db.primary.query(AUDIT_LINES_UNDER_KEY, [subjectKeyId])
        for (const line of orphaned) {
            expect(line.actor).toMatch(SEALED_BLOB)
            expect(line.actor).not.toContain(subject.personId)
        }

        // br.audit.erasure.logged: both transitions appended lines naming the requestId, sealed under the system key, which
        // survives so the audit trail itself never orphans. The lines arrive through the outbox, so they are awaited, and are
        // read in the order the transitions happened (their `at`), which the outbox does not promise to append them in.
        const systemLines = await world.waitUntil(
            "the two system erasure lines of the request",
            (): Promise<Array<AuditLineRow>> => world.db.primary.query(AUDIT_ERASURE_LINES_OF_REQUEST, [requestId]),
            (lines) => lines.length === 2,
            { timeoutMs: 60_000, intervalMs: 500 },
        )
        expect(systemLines.map((line) => line.action)).toEqual(["audit.erasure.requested", "audit.erasure.completed"])
        const systemKeyId = systemLines[0]?.key_id ?? ""
        const systemKey: Array<AuditKeyRow> = await world.db.primary.query(AUDIT_KEY_BY_ID, [systemKeyId])
        expect(systemKey).toEqual([{ person_id: "system", key_id: systemKeyId }])

        // The control is untouched: the control person still reads their own line and never the erased subject line.
        const controlTargets = await world.waitUntil(
            "the control own task line readable through the door",
            async () => (await exportedLines(asControl)).map((line) => line.target),
            (targets) => targets.includes(controlTaskId),
            { timeoutMs: 60_000, intervalMs: 1_000 },
        )
        expect(controlTargets).not.toContain(subjectTaskId)
    }, 300_000)
})
