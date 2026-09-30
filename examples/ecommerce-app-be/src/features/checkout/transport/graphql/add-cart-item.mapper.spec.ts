import { toAddCartItemRequest, toAddCartItemType } from "./add-cart-item.mapper"

describe("add-cart-item mapper", () => {
    it("maps the input to the request and the merged line to the type", () => {
        expect(toAddCartItemRequest({ productId: "mug", quantity: 2 })).toEqual({ productId: "mug", quantity: 2 })
        expect(toAddCartItemType({ productId: "mug", quantity: 5 })).toEqual({
            item: { productId: "mug", quantity: 5 },
        })
    })
})
