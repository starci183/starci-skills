import { randomUUID } from "node:crypto"
import { pollUntil } from "@e2e-kit/platform/poll"
import { bootE2eWorld } from "../setup/e2e-world"
import type { E2EWorld } from "../setup/e2e-world"
import { present } from "../setup/e2e.error"
import type {
    AuditLogData,
    CompleteTaskData,
    CreateTaskData,
    DeleteTaskData,
    ExportMyDataData,
} from "../setup/e2e-views.contracts"

/** The five tracked actions of contract.audit.emitted-events, as the log records them. */
const TRACKED_ACTIONS = ["login.signed-in", "login.signed-out", "task.created", "task.completed", "task.deleted"]

/** The `iv.tag.ciphertext` shape a sealed actor keeps: the plaintext personId must never appear. */
const SEALED_BLOB = /^[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}$/

/**
 * fr.audit.log.append + fr.audit.export + fr.audit.log.read as one A->Z journey: tracked actions through the public doors
 * write audit messages to the outbox in the same transaction as the action, the worker consumer appends them to the log, the
 * subject export returns those same lines decrypted, and the auditLog read agrees with the export line for line (a person
 * without the admin role reads exactly their own lines). The postgres reads are out-of-band verification only: every stored
 * actor stays sealed and the hash chain the lines were appended into is recomputed link by link.
 */
describe("export-and-log (e2e)", () => {
    let world: E2EWorld

    beforeAll(async () => {
        world = await bootE2eWorld("audit/export-and-log")
        expect((await world.http().get<{ status: string }>("/health")).body.status).toBe("ok")
    }, 600_000)

    afterAll(async () => {
        await world.close()
        expect(world.stack.cleanupReport?.clean).toBe(true)
    })

    it("tracked activity -> audit lines appended -> exportMyData returns them -> auditLog agrees", async () => {
        const { graphql, auth, database } = world
        const marker = `e2e-export-${randomUUID()}`
        const owner = await auth.persona("owner")
        const asOwner = graphql.client(owner.sessionToken)

        // The task lifecycle through the public doors.
        const created = await asOwner.mutate<CreateTaskData>("createTask", { variables: { input: { title: marker } } })
        expect(created.errorCode).toBeNull()
        const taskId = present(created.data, "createTask data").createTask.taskId
        const done = await asOwner.mutate<CompleteTaskData>("completeTask", { variables: { input: { id: taskId } } })
        expect(done.errorCode).toBeNull()
        const removed = await asOwner.mutate<DeleteTaskData>("deleteTask", { variables: { input: { id: taskId } } })
        expect(removed.errorCode).toBeNull()

        // A second session signed in and back out through the door, so both login actions land while the primary session
        // stays alive for the reads below.
        const second = await auth.signInAs("owner")
        await auth.signOut(second.sessionToken)

        // The append path is asynchronous (outbox, then the worker consumer): poll the public read until every tracked
        // action shows up as a line.
        const lines = await pollUntil(
            "all tracked actions visible in auditLog",
            async () => {
                const observed = await asOwner.read<AuditLogData>("auditLog")
                const read = observed.data?.auditLog ?? []
                return TRACKED_ACTIONS.every((action) => read.some((line) => line.action === action)) ? read : null
            },
            90_000,
            1_000,
        )
        expect(lines.filter((line) => line.action === "task.created" && line.target === taskId)).toHaveLength(1)
        expect(lines.filter((line) => line.action === "task.completed" && line.target === taskId)).toHaveLength(1)
        expect(lines.filter((line) => line.action === "task.deleted" && line.target === taskId)).toHaveLength(1)

        // The export door resolves the same per-person lines as the log read: an identical, ordered set.
        const exported = await asOwner.read<ExportMyDataData>("exportMyData")
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

        // Out-of-band: every line the door returned exists as a stored row under the subject key id, with the actor sealed
        // and action/target in the clear exactly as the door reported them.
        const keys = await database.auditKeysOfPerson(owner.personId)
        expect(keys).toHaveLength(1)
        const stored = await database.auditLinesUnderKey(present(keys[0], "the owner audit key").key_id)
        expect(stored.map((line) => ({ action: line.action, target: line.target }))).toEqual(
            lines.map((line) => ({ action: line.action, target: line.target })),
        )
        for (const line of stored) {
            expect(line.actor).toMatch(SEALED_BLOB)
            expect(line.actor).not.toContain(owner.personId)
        }

        // Append-only means chain-consistent: recompute the linkage across the whole table.
        const chain = await database.auditChain()
        expect(chain.length).toBeGreaterThanOrEqual(stored.length)
        expect(chain[0]?.prev_hash).toBe("GENESIS")
        for (let index = 1; index < chain.length; index += 1) {
            expect(chain[index]?.prev_hash).toBe(chain[index - 1]?.hash)
        }

        // The outbox delivered every message: nothing gave up.
        expect(await database.outboxDeadCount()).toBe(0)
    }, 300_000)
})
