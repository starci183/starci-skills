import { Test } from "@nestjs/testing"
import { ATTEMPTS, BACKOFF_MS, backoffSecondsOf, deliveryOf, isExhausted, messageOf, secondsOf } from "./queue.policy"

const QUEUE_POLICY = Symbol("QUEUE_POLICY")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: QUEUE_POLICY,
                useValue: { backoffSecondsOf, deliveryOf, isExhausted, messageOf, secondsOf },
            },
        ],
    }).compile()
    return moduleRef.get<Omit<typeof import("./queue.policy"), "ATTEMPTS" | "BACKOFF_MS">>(QUEUE_POLICY)
}

describe("queue policy", () => {
    it("declares the retry budget of every job", () => {
        expect({ attempts: ATTEMPTS, backoffMs: BACKOFF_MS }).toEqual({ attempts: 5, backoffMs: 1000 })
    })

    it("rounds milliseconds up to whole seconds", async () => {
        const policy = await build()
        expect([policy.secondsOf(0), policy.secondsOf(1), policy.secondsOf(1000), policy.secondsOf(30_001)]).toEqual([
            0, 1, 1, 31,
        ])
    })

    it("doubles the backoff with every read of the message", async () => {
        const policy = await build()
        expect([0, 1, 2, 3, 4].map(policy.backoffSecondsOf)).toEqual([1, 1, 2, 4, 8])
    })

    it("exhausts a job on its last attempt", async () => {
        const policy = await build()
        expect([
            policy.isExhausted(ATTEMPTS - 1),
            policy.isExhausted(ATTEMPTS),
            policy.isExhausted(ATTEMPTS + 1),
        ]).toEqual([false, true, true])
    })

    it("carries the outbox row id with the payload in the message", async () => {
        const policy = await build()
        expect(policy.messageOf("row-1", { bookingId: "b-1" })).toEqual({
            jobId: "row-1",
            payload: { bookingId: "b-1" },
        })
    })

    it("delivers an enqueued job under its outbox row id and the read count as its attempt", async () => {
        const policy = await build()
        expect(
            policy.deliveryOf("mail", { msg_id: "7", read_ct: 2, message: { jobId: "row-1", payload: { id: "m-1" } } }),
        ).toEqual({ id: "row-1", queue: "mail", payload: { id: "m-1" }, attempt: 2 })
    })

    it("delivers a scheduler tick under its message id with an empty payload when it has none", async () => {
        const policy = await build()
        expect(policy.deliveryOf("sweep", { msg_id: "42", read_ct: 1, message: {} })).toEqual({
            id: "42",
            queue: "sweep",
            payload: {},
            attempt: 1,
        })
    })

    it("preserves the reminder payload that the migration-owned cron tick enqueues", async () => {
        const policy = await build()
        expect(
            policy.deliveryOf("booking_reminder", {
                msg_id: "43",
                read_ct: 1,
                message: { payload: { tick: true } },
            }),
        ).toEqual({ id: "43", queue: "booking_reminder", payload: { tick: true }, attempt: 1 })
    })
})
