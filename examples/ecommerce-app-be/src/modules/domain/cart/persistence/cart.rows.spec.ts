import { toCartLine } from "./cart.rows"

describe("toCartLine", () => {
    it("maps the snake_case row to a cart line", () => {
        expect(toCartLine([{ product_id: "sku-1", quantity: 3 }])).toEqual({ productId: "sku-1", quantity: 3 })
    })

    it("answers null when the upsert answered no row", () => {
        expect(toCartLine([])).toBeNull()
    })
})
