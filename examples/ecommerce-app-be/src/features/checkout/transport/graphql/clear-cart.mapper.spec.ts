import { toClearCartType } from "./clear-cart.mapper"

describe("toClearCartType", () => {
    it("maps the confirmation to the GraphQL type", () => {
        expect(toClearCartType({ cleared: true })).toEqual({ cleared: true })
    })
})
