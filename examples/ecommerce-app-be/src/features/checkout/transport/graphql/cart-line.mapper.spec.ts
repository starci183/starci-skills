import { toCartLineType } from "./cart-line.mapper"

describe("toCartLineType", () => {
    it("maps a cart line to the GraphQL type", () => {
        expect(toCartLineType({ productId: "mug", quantity: 2 })).toEqual({ productId: "mug", quantity: 2 })
    })
})
