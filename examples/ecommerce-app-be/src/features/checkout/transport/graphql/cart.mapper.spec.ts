import { toCartType } from "./cart.mapper"

describe("toCartType", () => {
    it("maps the lines and the catalog snapshot", () => {
        const product = { id: "mug", name: "Mug", priceMinorUnits: 1299, stock: 5 }
        expect(toCartType({ items: [{ productId: "mug", quantity: 2 }], catalog: [product] })).toEqual({
            items: [{ productId: "mug", quantity: 2 }],
            catalog: [product],
        })
    })
})
