import { toAccountType, toGetAccountRequest } from "./account.mapper"

describe("account mapper", () => {
    it("carries the bearer token into the request and the overview into the type", () => {
        expect(toGetAccountRequest("tok")).toEqual({ sessionToken: "tok" })
        expect(toAccountType({ personId: "p-1", email: "a@example.com", hasOrders: true })).toEqual({
            personId: "p-1",
            email: "a@example.com",
            hasOrders: true,
        })
    })
})
