import { present } from "./present.mapper"

describe("present", () => {
    it("answers a present value, zero included", () => {
        expect(present(0, "zero")).toBe(0)
    })

    it("names an absent value", () => {
        expect(() => present(undefined, "the cart")).toThrow("the cart is absent")
    })
})
