import { toBuyerStatus, toOrderId } from "./order.rows"

describe("toOrderId", () => {
    it("answers the id of the inserted row and null when the key was used", () => {
        expect(toOrderId([{ id: "o-1" }])).toBe("o-1")
        expect(toOrderId([])).toBeNull()
    })
})

describe("toBuyerStatus", () => {
    it("is a buyer when the count is above zero", () => {
        expect(toBuyerStatus("p-1", [{ order_count: 2 }])).toEqual({ personId: "p-1", hasOrders: true })
    })

    it("is not a buyer at zero orders or with no row", () => {
        expect(toBuyerStatus("p-1", [{ order_count: 0 }]).hasOrders).toBe(false)
        expect(toBuyerStatus("p-1", []).hasOrders).toBe(false)
    })
})
