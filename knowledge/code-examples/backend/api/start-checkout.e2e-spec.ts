// Imports the host resolves:
//   import { useTestWorld } from "../../world/use-test-world"

describe("startCheckout (e2e)", () => {
    const world = useTestWorld({ apps: ["order"] })

    it("starts a checkout for a signed-in shopper and returns the typed payload", async () => {
        const shopper = await world.signedInPerson()
        const result = await world.apps.order.api.mutate("startCheckout", { variables: { input: { cartId: shopper.cartId } }, token: shopper.token })
        expect(result.data?.startCheckout.status).toBe("PENDING")
    })

    it("refuses the same call without a token", async () => {
        const result = await world.apps.order.api.mutate("startCheckout", { variables: { input: { cartId: "none" } } })
        expect(result.errorCode).toBe("UNAUTHENTICATED")
    })
})
