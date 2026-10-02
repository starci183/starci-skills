import { fakeIds } from "@starci/jest-preset"
import { ORDER_API, OrderApiErrorCode } from "@modules/integrations/order-api"
import type { OrderApiClient } from "@modules/integrations/order-api"
import { ORDER_API_CAPABILITY_MODULES } from "../../world/test-capabilities.options"
import { useTestWorld } from "../../world/use-test-world"

/** The ids of the rows and keys this spec arranges: deterministic, so a failing run reproduces. */
const ids = fakeIds()

/**
 * order-api: the identity app's real client of the order service against the real order app the world boots beside it (and
 * the identity app the order app verifies sessions with), no fake in between. A signed-in buyer's status reads back from
 * the order service; a session the order service refuses is the declared unavailable refusal naming its code, and an order
 * service that is down is the same refusal, with the client served again once the service is back.
 */
describe("order-api: order service client (integration)", () => {
    const world = useTestWorld({ modules: ORDER_API_CAPABILITY_MODULES, apps: ["identity", "order"] })

    const orderApi = (): OrderApiClient => world.resolve<OrderApiClient>(ORDER_API)

    it("reads the buyer status of a signed-in person from the order service", async () => {
        const buyer = await world.signedInPerson("order-api")

        expect(await orderApi().getBuyerStatus(buyer.sessionToken)).toEqual({
            personId: buyer.personId,
            hasOrders: false,
        })
    })

    it("a session the order service refuses is the declared unavailable refusal naming its code", async () => {
        await expect(orderApi().getBuyerStatus(`unknown-${ids.next()}`)).rejects.toMatchObject({
            code: OrderApiErrorCode.Unavailable,
            params: { reason: expect.stringContaining("UNAUTHENTICATED") },
        })
    })

    it("an order service that is down is the declared unavailable refusal, and the client is served again once it is back", async () => {
        const buyer = await world.signedInPerson("order-api-outage")

        await world.apps.order.during(async () => {
            await expect(orderApi().getBuyerStatus(buyer.sessionToken)).rejects.toMatchObject({
                code: OrderApiErrorCode.Unavailable,
            })
        })

        expect((await orderApi().getBuyerStatus(buyer.sessionToken)).personId).toBe(buyer.personId)
    })
})
