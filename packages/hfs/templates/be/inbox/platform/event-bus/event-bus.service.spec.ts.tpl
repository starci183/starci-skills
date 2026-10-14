import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { BaseEvent } from "./event-bus.contracts"
import { EventBusService } from "./event-bus.service"
import { INSERT_OUTBOX_EVENT } from "./persistence/event-bus.sql"

class ReceiptRecordedEvent extends BaseEvent {
    readonly eventId = "receipt-1"
    readonly eventName = "spec.delivery-recorded"
    readonly payload = { receiptId: "receipt-1" }
}

describe("EventBusService", () => {
    const build = async () => {
        const module = await Test.createTestingModule({ providers: [EventBusService] }).compile()
        return module.get(EventBusService)
    }

    it("writes the typed envelope through the receipt transaction", async () => {
        const subject = await build()
        const transaction = fakeTransaction(mockEntityManager({ query: [INSERT_OUTBOX_EVENT, []] }))
        const event = new ReceiptRecordedEvent()

        await transaction.em.transaction((manager) => subject.publish(event, manager))

        expect(transaction.em.query).toHaveBeenCalledWith(INSERT_OUTBOX_EVENT, [
            "receipt-1",
            "spec.delivery-recorded",
            JSON.stringify({ eventId: event.eventId, eventName: event.eventName, payload: event.payload }),
        ])
        expect(transaction.commits).toBe(1)
    })

    it("propagates an outbox failure so the receipt transaction rolls back", async () => {
        const subject = await build()
        const manager = mockEntityManager({ query: [INSERT_OUTBOX_EVENT, []] })
        jest.spyOn(manager, "query").mockRejectedValue(new Error("outbox unavailable"))
        const transaction = fakeTransaction(manager)

        await expect(transaction.em.transaction((tx) => subject.publish(new ReceiptRecordedEvent(), tx))).rejects.toThrow("outbox unavailable")

        expect(transaction.commits).toBe(0)
        expect(transaction.rollbacks).toBe(1)
    })
})
