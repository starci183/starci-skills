import { orderStatusTopic } from "@modules/domain/order"
import type { OrderStatusFrame } from "@modules/domain/order"
import { REALTIME_HUB } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import { REALTIME_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

const FRAME: OrderStatusFrame = { orderId: "o-1", status: "paid", changedAt: "2026-10-02T03:00:00.000Z" }

/**
 * realtime: the real hub module of an app instance, no HTTP door of ours. A reader that stops reading its stream releases its
 * subscription, so a disconnected client leaves nothing behind and later pushes reach no one; another reader of the same topic
 * is unaffected by it; and a different principal's topic never carries a frame published to the first one.
 */
describe("realtime: hub (integration)", () => {
    const world = useTestWorld({ modules: REALTIME_CAPABILITY_MODULES })

    const hub = (): RealtimeHub => world.resolve<RealtimeHub>(REALTIME_HUB)

    it("realtime/disconnect-releases-subscription: a reader that stops reading leaves no subscription and receives nothing afterwards", async () => {
        const topic = orderStatusTopic("buyer-disconnect", "o-1")
        const leaving = hub().subscribe(topic)[Symbol.asyncIterator]()
        const staying = hub().subscribe(topic)[Symbol.asyncIterator]()
        expect(hub().subscriberCount(topic)).toBe(2)

        await leaving.return?.()
        hub().publish(topic, FRAME)

        expect(hub().subscriberCount(topic)).toBe(1)
        expect(await leaving.next()).toEqual({ done: true, value: undefined })
        expect(await staying.next()).toEqual({ done: false, value: FRAME })
        await staying.return?.()
        expect(hub().subscriberCount(topic)).toBe(0)
    })

    it("a frame published to one buyer's channel never reaches another buyer's channel of the same order", async () => {
        const owner = hub().subscribe(orderStatusTopic("buyer-owner", "o-2"))[Symbol.asyncIterator]()
        const other = hub().subscribe(orderStatusTopic("buyer-other", "o-2"))[Symbol.asyncIterator]()

        hub().publish(orderStatusTopic("buyer-owner", "o-2"), { ...FRAME, orderId: "o-2" })

        expect(await owner.next()).toEqual({ done: false, value: { ...FRAME, orderId: "o-2" } })
        expect(hub().subscriberCount(orderStatusTopic("buyer-other", "o-2"))).toBe(1)
        await other.return?.()
        await owner.return?.()
    })
})
