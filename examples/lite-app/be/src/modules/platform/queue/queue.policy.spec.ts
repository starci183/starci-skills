import {
    ATTEMPTS,
    BACKOFF_MS,
    backoffSecondsOf,
    cronScheduleOf,
    deliveryOf,
    isExhausted,
    messageOf,
    secondsOf,
} from "./queue.policy"

describe("queue policy", () => {
    it("declares the retry budget of every job", () => {
        expect({ attempts: ATTEMPTS, backoffMs: BACKOFF_MS }).toEqual({ attempts: 5, backoffMs: 1000 })
    })

    it("rounds milliseconds up to whole seconds", () => {
        expect([secondsOf(0), secondsOf(1), secondsOf(1000), secondsOf(30_001)]).toEqual([0, 1, 1, 31])
    })

    it("doubles the backoff with every read of the message", () => {
        expect([0, 1, 2, 3, 4].map(backoffSecondsOf)).toEqual([1, 1, 2, 4, 8])
    })

    it("exhausts a job on its last attempt", () => {
        expect([isExhausted(ATTEMPTS - 1), isExhausted(ATTEMPTS), isExhausted(ATTEMPTS + 1)]).toEqual([
            false,
            true,
            true,
        ])
    })

    it("carries the outbox row id with the payload in the message", () => {
        expect(messageOf("row-1", { bookingId: "b-1" })).toEqual({ jobId: "row-1", payload: { bookingId: "b-1" } })
    })

    it("delivers an enqueued job under its outbox row id and the read count as its attempt", () => {
        expect(
            deliveryOf("mail", { msg_id: "7", read_ct: 2, message: { jobId: "row-1", payload: { id: "m-1" } } }),
        ).toEqual({ id: "row-1", queue: "mail", payload: { id: "m-1" }, attempt: 2 })
    })

    it("delivers a scheduler tick under its message id with an empty payload when it has none", () => {
        expect(deliveryOf("sweep", { msg_id: "42", read_ct: 1, message: {} })).toEqual({
            id: "42",
            queue: "sweep",
            payload: {},
            attempt: 1,
        })
    })

    it("maps an interval to the pg_cron schedule of seconds, minutes or hours", () => {
        expect([
            cronScheduleOf(200),
            cronScheduleOf(30_000),
            cronScheduleOf(60_000),
            cronScheduleOf(900_000),
            cronScheduleOf(3_600_000),
            cronScheduleOf(172_800_000),
        ]).toEqual(["1 seconds", "30 seconds", "*/1 * * * *", "*/15 * * * *", "0 */1 * * *", "0 */23 * * *"])
    })
})
