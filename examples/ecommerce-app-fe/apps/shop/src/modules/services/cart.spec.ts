import { describe, expect, it } from "vitest"
import { readCart, summarizeCart, type CartView } from "./cart"

const view: CartView = {
    items: [
        { productId: "lamp", quantity: 2 },
        { productId: "ghost", quantity: 1 },
    ],
    catalog: [{ id: "lamp", name: "Desk Lamp", priceMinorUnits: 8900, stock: 4 }],
}

describe("summarizeCart", () => {
    it("joins each line with its catalog row and totals the known lines", () => {
        const summary = summarizeCart(view, (count) => `x${count}`)
        expect(summary.rows[0]).toEqual({ productId: "lamp", name: "Desk Lamp", quantityLabel: "x2", lineTotal: "$178.00" })
        expect(summary.total).toBe("$178.00")
        expect(summary.productNames).toEqual({ lamp: "Desk Lamp" })
    })

    it("renders a line the catalog no longer knows under its id, with no total", () => {
        const summary = summarizeCart(view, (count) => `x${count}`)
        expect(summary.rows[1]).toEqual({ productId: "ghost", name: "ghost", quantityLabel: "x1", lineTotal: "—" })
    })

    it("answers an anonymous read with no rows and a zero total, without asking the service", async () => {
        const read = await readCart(null, (count) => `x${count}`)
        expect(read.result).toMatchObject({ ok: false, code: "SESSION_INVALID" })
        expect(read.summary.rows).toEqual([])
        expect(read.summary.total).toBe("$0.00")
    })
})
