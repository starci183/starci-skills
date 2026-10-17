import { Test } from "@nestjs/testing"
import { isOrderStatusFrame, orderStatusTopic } from "./order-status.policy"

const frame = {
    orderId: "order-1",
    status: "paid",
    changedAt: "2026-10-01T12:00:00.000Z",
} as const

const SUBJECT = Symbol("order status policy")
const build = async () => {
    const policy = { isOrderStatusFrame, orderStatusTopic }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => policy }],
    }).compile()
    return moduleRef.get<typeof policy>(SUBJECT)
}

describe("isOrderStatusFrame", () => {
    it.each(["pending", "paid", "expired", "cancelled"])("accepts the %s status", async (status) => {
        const subject = await build()
        expect(subject.isOrderStatusFrame({ ...frame, status })).toBe(true)
    })

    it.each([
        ["a non-object", null],
        ["an array", [frame]],
        ["a missing order id", { status: "paid", changedAt: frame.changedAt }],
        ["a non-string order id", { ...frame, orderId: 1 }],
        ["a missing status", { orderId: frame.orderId, changedAt: frame.changedAt }],
        ["a non-string status", { ...frame, status: 1 }],
        ["an unknown status", { ...frame, status: "shipped" }],
        ["a missing change instant", { orderId: frame.orderId, status: "paid" }],
        ["a non-string change instant", { ...frame, changedAt: 1 }],
    ])("rejects %s", async (_case, value) => {
        const subject = await build()
        expect(subject.isOrderStatusFrame(value)).toBe(false)
    })
})

describe("orderStatusTopic", () => {
    it("scopes the channel to the buyer and order and validates its frames", async () => {
        const subject = await build()
        const topic = subject.orderStatusTopic("person-1", "order-1")

        expect(topic.name).toBe("order-status:person-1:order-1")
        expect(topic.accepts(frame)).toBe(true)
        expect(topic.accepts({ ...frame, status: "shipped" })).toBe(false)
    })
})
