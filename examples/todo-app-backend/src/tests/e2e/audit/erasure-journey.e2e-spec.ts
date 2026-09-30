import { randomUUID } from "node:crypto"
import { pollUntil } from "@e2e-kit/platform/poll"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import { present } from "../setup/e2e.error"
import type {
    AuditLogData,
    CompleteErasureData,
    CreateTaskData,
    ExportMyDataData,
    RequestErasureData,
} from "../setup/e2e-views.contracts"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The `iv.tag.ciphertext` shape a sealed actor keeps: the plaintext personId must never appear. */
const SEALED_BLOB = /^[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}$/

/**
 * fr.audit.erasure.request + fr.audit.erasure.complete as one A->Z journey: the subject produces readable audit lines
 * (asynchronously, through the outbox and the worker), requests erasure (the request is verified in the same step), completes
 * it (the subject key is crypto-shredded and person_id scrubbed), and both transitions leave system-actor lines naming only
 * the requestId. Reads happen through the public doors; the postgres reads are out-of-band verification of the
 * anonymization, never a shortcut around it. The subject is a throwaway realm account, not a seeded persona: a completed
 * erasure destroys that identity audit key for the rest of this stack lifetime, so the demo owner is only ever the control
 * reader.
 */
describe("erasure journey (e2e)", () => {
    let world: E2EWorld
    let subjectPersonId: string | null = null

    beforeAll(async () => {
        world = await bootE2eWorld("audit/erasure-journey")
        expect((await world.http().get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 600_000)

    afterAll(async () => {
        try {
            if (subjectPersonId !== null) await world.auth.deleteAccount(subjectPersonId)
        } finally {
            await world.close()
        }
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("request-erasure -> verified row -> complete-erasure -> subject anonymized (api + db) -> system lines appended", async () => {
        const { graphql, auth, database } = world
        const marker = `e2e-erasure-${randomUUID()}`
        const subjectEmail = `${marker}@todo.dev`
        const created = await auth.createAccount({ email: subjectEmail, password: "e2e-erasure-pass" })
        subjectPersonId = created.personId
        const subject = await auth.signIn(subjectEmail, "e2e-erasure-pass")
        expect(subject.personId).toBe(subjectPersonId)
        const owner = await auth.persona("owner")
        const asSubject = graphql.client(subject.sessionToken)
        const asOwner = graphql.client(owner.sessionToken)

        // Activity that must become unreadable: one task by the future subject, one by the control.
        const subjectTask = await asSubject.mutate<CreateTaskData>("createTask", { variables: { input: { title: `${marker}-subject` } } })
        expect(subjectTask.errorCode).toBeNull()
        const subjectTaskId = present(subjectTask.data, "createTask data").createTask.taskId
        const ownerTask = await asOwner.mutate<CreateTaskData>("createTask", { variables: { input: { title: `${marker}-owner` } } })
        expect(ownerTask.errorCode).toBeNull()
        const ownerTaskId = present(ownerTask.data, "createTask data").createTask.taskId

        // The audit line is appended asynchronously (outbox message, then the worker consumer), so a response can beat the
        // line it triggered: wait until both of the subject lines (sign-in and task creation) are readable through the door.
        const beforeExport = await pollUntil(
            "the audit lines of the subject readable through the door",
            async () => {
                const observed = await asSubject.read<ExportMyDataData>("exportMyData")
                const lines = observed.data?.exportMyData ?? []
                const complete =
                    lines.some((line) => line.action === "task.created" && line.target === subjectTaskId) &&
                    lines.some((line) => line.action === "login.signed-in")
                return complete ? lines : null
            },
            90_000,
            1_000,
        )
        expect(beforeExport.length).toBeGreaterThanOrEqual(2)

        // Out-of-band: the subject sealing key exists, so their lines are readable today.
        const keysBefore = await database.auditKeysOfPerson(subject.personId)
        expect(keysBefore).toHaveLength(1)
        const subjectKeyId = present(keysBefore[0], "the subject audit key").key_id
        const subjectLinesBefore = await database.auditLineCountUnderKey(subjectKeyId)
        expect(subjectLinesBefore).toBe(beforeExport.length)

        // Request and verify: the door returns the already-verified request.
        const requested = await asSubject.mutate<RequestErasureData>("requestErasure")
        expect(requested.errorCode).toBeNull()
        const request = present(requested.data, "requestErasure data").requestErasure
        expect(request.requestId).toMatch(UUID)
        expect(request.state).toBe("verified")
        const requestedRow = await database.auditErasureRequest(request.requestId)
        expect(requestedRow).toHaveLength(1)
        expect(requestedRow[0]?.state).toBe("verified")
        expect(requestedRow[0]?.person_id).toBe(subject.personId)
        expect(requestedRow[0]?.verified_at).not.toBeNull()

        // Execute: the key is destroyed, then the state flips and person_id is dropped.
        const completed = await asSubject.mutate<CompleteErasureData>("completeErasure", { variables: { input: { requestId: request.requestId } } })
        expect(completed.errorCode).toBeNull()
        expect(completed.data?.completeErasure).toEqual({ requestId: request.requestId, state: "complete" })

        // Anonymized through the api: both of the subject own reads now return nothing.
        const exportAfter = await asSubject.read<ExportMyDataData>("exportMyData")
        const logAfter = await asSubject.read<AuditLogData>("auditLog")
        expect(exportAfter.errorCode).toBeNull()
        expect(logAfter.errorCode).toBeNull()
        expect(exportAfter.data?.exportMyData).toEqual([])
        expect(logAfter.data?.auditLog).toEqual([])

        // Anonymized out-of-band: the key row and the person_id on the request are both gone.
        expect(await database.auditKeysOfPersonOrKey(subject.personId, subjectKeyId)).toEqual([])
        const completedRow = await database.auditErasureRequest(request.requestId)
        expect(completedRow[0]?.state).toBe("complete")
        expect(completedRow[0]?.person_id).toBeNull()
        expect(completedRow[0]?.executing_at).not.toBeNull()
        expect(completedRow[0]?.completed_at).not.toBeNull()

        // Crypto-shred, not deletion: the stored lines of the subject survive untouched under the orphaned key id, each
        // actor still a sealed blob that no longer resolves to anyone.
        expect(await database.auditLineCountUnderKey(subjectKeyId)).toBe(subjectLinesBefore)
        for (const line of await database.auditLinesUnderKey(subjectKeyId)) {
            expect(line.actor).toMatch(SEALED_BLOB)
            expect(line.actor).not.toContain(subject.personId)
        }

        // br.audit.erasure.logged: both transitions appended lines naming the requestId, sealed under the system key, which
        // survives so the audit trail itself never orphans. The lines arrive through the outbox, so they are awaited.
        const systemLines = await pollUntil(
            "the two system erasure lines of the request",
            async () => {
                const lines = await database.auditErasureLinesOfRequest(request.requestId)
                return lines.length === 2 ? lines : null
            },
            60_000,
            500,
        )
        expect(systemLines.map((line) => line.action)).toEqual(["audit.erasure.requested", "audit.erasure.completed"])
        const systemKeyId = present(systemLines[0], "the first system erasure line").key_id
        expect(await database.auditKeyById(systemKeyId)).toEqual([{ person_id: "system", key_id: systemKeyId }])

        // The control is untouched: the owner still reads their own line and never the erased subject line.
        const ownerTargets = await pollUntil(
            "the owner own task line readable through the door",
            async () => {
                const observed = await asOwner.read<ExportMyDataData>("exportMyData")
                const targets = (observed.data?.exportMyData ?? []).map((line) => line.target)
                return targets.includes(ownerTaskId) ? targets : null
            },
            60_000,
            1_000,
        )
        expect(ownerTargets).not.toContain(subjectTaskId)
    }, 300_000)
})
