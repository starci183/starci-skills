import { mock } from "@starci/jest-preset/mock"
import type { TestApi } from "../world/use-test-world"
import { asBearer, present } from "./bearer.mapper"

describe("asBearer", () => {
    it("adds the token to every call of the door", async () => {
        const api = mock<TestApi>({ read: jest.fn().mockResolvedValue("r"), mutate: jest.fn().mockResolvedValue("m") })
        const buyer = asBearer(api, "tok")
        await buyer.read("cart", { variables: { a: 1 } })
        await buyer.mutate("clearCart")
        expect(api.read).toHaveBeenCalledWith("cart", { variables: { a: 1 }, token: "tok" })
        expect(api.mutate).toHaveBeenCalledWith("clearCart", { token: "tok" })
    })
})

describe("present", () => {
    it("answers a present value and names an absent one", () => {
        expect(present(0, "zero")).toBe(0)
        expect(() => present(undefined, "the cart")).toThrow("the cart is absent")
    })
})
