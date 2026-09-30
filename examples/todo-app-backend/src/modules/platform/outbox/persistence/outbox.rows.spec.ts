import { toOutboxRecord } from "./outbox.rows"

describe("outbox rows mapper", () => {
    it("maps a claimed row to the record a worker delivers", () => {
        const row = { id: "m1", queue: "notify.admit", event_id: "e1", payload: { taskId: "t1" }, attempts: 2 }
        expect(toOutboxRecord(row)).toEqual({ id: "m1", queue: "notify.admit", eventId: "e1", payload: { taskId: "t1" }, attempts: 2 })
    })
})
