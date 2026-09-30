import { randomUUID } from "node:crypto"
import {
    AUDIT_CHAIN,
    AUDIT_KEYS_OF_PERSON,
    AUDIT_LINES_UNDER_KEY,
    OUTBOX_DEAD_COUNT,
} from "@tests/fixtures/persistence/e2e-verification.sql"
import type { AuditChainRow, AuditKeyRow, AuditLineRow, CountRow } from "@tests/fixtures/persistence/e2e-verification.rows"
import type {
    AuditLogData,
    CompleteTaskData,
    CreateTaskData,
    DeleteTaskData,
    ExportMyDataData,
    SignOutData,
} from "@tests/fixtures/views/e2e-views.contracts"
import { useTestWorld } from "@tests/world/test-world.service"
import { AppModule as TodoApp } from "../../../../apps/todo/src/app.module"
import { AppModule as WorkerApp } from "../../../../apps/worker/src/app.module"

/** The five tracked actions of contract.audit.emitted-events, as the log records them. */
const TRACKED_ACTIONS = ["login.signed-in", "login.signed-out", "task.created", "task.completed", "task.deleted"]

/** The `iv.tag.ciphertext` shape a sealed actor keeps: the plaintext personId must never appear. */
const SEALED_BLOB = /^[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}$/

/**
 * fr.audit.log.append + fr.audit.export + fr.audit.log.read as one A->Z journey: tracked actions through the public doors
 * write audit messages to the outbox in the same transaction as the action, the worker consumer appends them to the log, the
 * subject export returns those same lines decrypted, and the auditLog read agrees with the export line for line (a person
 * without the admin role reads exactly their own lines). The reads of stored rows go through the shared entity manager:
 * every stored actor stays sealed and the hash chain the lines were appended into is recomputed link by link.
 */
describe("export-and-log (e2e)", () => {
    const world = useTestWorld({ apps: { todo: { module: TodoApp, listen: true }, worker: { module: WorkerApp } } })

    it("tracked activity -> audit lines appended -> exportMyData returns them -> auditLog agrees", async () => {
        const { api } = world.apps.todo
        const marker = `e2e-export-${randomUUID()}`
        const owner = await world.signedInPerson("export")
        const asOwner = owner.caller

        // The task lifecycle through the public doors.
        const created = await asOwner.graphql<CreateTaskData>("createTask", { input: { title: marker } })
        expect(created.errorCode).toBeNull()
        const taskId = created.data?.createTask.taskId ?? ""
        expect((await asOwner.graphql<CompleteTaskData>("completeTask", { input: { id: taskId } })).errorCode).toBeNull()
        expect((await asOwner.graphql<DeleteTaskData>("deleteTask", { input: { id: taskId } })).errorCode).toBeNull()

        // A second session signed in and back out through the door, so both login actions land while the primary session
        // stays alive for the reads below.
        const second = await api.signIn(owner.email, owner.password)
        await api.graphql<SignOutData>("signOut", { input: { sessionToken: second.sessionToken } })

        // The append path is asynchronous (outbox, then the worker consumer): wait until every tracked action shows up as a line.
        const lines = await world.waitFor(
            "all tracked actions visible in auditLog",
            async () => {
                const observed = await asOwner.graphql<AuditLogData>("auditLog")
                const read = observed.data?.auditLog ?? []
                return TRACKED_ACTIONS.every((action) => read.some((line) => line.action === action)) ? read : null
            },
            { timeoutMs: 90_000, intervalMs: 1_000 },
        )
        expect(lines.filter((line) => line.action === "task.created" && line.target === taskId)).toHaveLength(1)
        expect(lines.filter((line) => line.action === "task.completed" && line.target === taskId)).toHaveLength(1)
        expect(lines.filter((line) => line.action === "task.deleted" && line.target === taskId)).toHaveLength(1)

        // The export door resolves the same per-person lines as the log read: an identical, ordered set.
        const exported = await asOwner.graphql<ExportMyDataData>("exportMyData")
        expect(exported.errorCode).toBeNull()
        expect(exported.data?.exportMyData).toEqual(lines)

        // The response type is the boundary: three fields, never an actor, a key id or a chain position.
        for (const line of lines) {
            expect(Object.keys(line).sort()).toEqual(["action", "at", "target"])
            expect(new Date(line.at).getTime()).not.toBeNaN()
        }
        const serialized = JSON.stringify(lines)
        expect(serialized).not.toMatch(SEALED_BLOB)
        expect(serialized.toLowerCase()).not.toContain("keyid")
        expect(serialized.toLowerCase()).not.toContain("prevhash")

        // Every line the door returned exists as a stored row under the subject key id, with the actor sealed and
        // action/target in the clear exactly as the door reported them.
        const keys: Array<AuditKeyRow> = await world.db.primary.query(AUDIT_KEYS_OF_PERSON, [owner.personId])
        expect(keys).toHaveLength(1)
        const stored: Array<AuditLineRow> = await world.db.primary.query(AUDIT_LINES_UNDER_KEY, [keys[0]?.key_id])
        expect(stored.map((line) => ({ action: line.action, target: line.target }))).toEqual(
            lines.map((line) => ({ action: line.action, target: line.target })),
        )
        for (const line of stored) {
            expect(line.actor).toMatch(SEALED_BLOB)
            expect(line.actor).not.toContain(owner.personId)
        }

        // Append-only means chain-consistent: recompute the linkage across the whole table (shared with the other flows).
        const chain: Array<AuditChainRow> = await world.db.primary.query(AUDIT_CHAIN, [])
        expect(chain.length).toBeGreaterThanOrEqual(stored.length)
        expect(chain[0]?.prev_hash).toBe("GENESIS")
        for (let index = 1; index < chain.length; index += 1) {
            expect(chain[index]?.prev_hash).toBe(chain[index - 1]?.hash)
        }

        // The outbox delivered every message: nothing gave up.
        const [dead]: Array<CountRow> = await world.db.primary.query(OUTBOX_DEAD_COUNT, [])
        expect(dead?.count).toBe(0)
    }, 300_000)
})
