import type { EntityManager } from "typeorm"
import { EventBusService } from "./event-bus.service"

describe("EventBusService", () => {
    it("only persists the typed event through the caller transaction", async () => {
        const query = jest.fn().mockResolvedValue([])
        const tx = { query } as unknown as EntityManager
        const service = new EventBusService({} as EntityManager)

        await service.publish({ eventId: "e-1", eventName: "order.placed", payload: { orderId: "o-1" } }, tx)

        expect(query).toHaveBeenCalledTimes(1)
        expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO public.event_bus"), [
            "e-1", "order.placed", JSON.stringify({ eventId: "e-1", eventName: "order.placed", payload: { orderId: "o-1" } }),
        ])
    })
})
