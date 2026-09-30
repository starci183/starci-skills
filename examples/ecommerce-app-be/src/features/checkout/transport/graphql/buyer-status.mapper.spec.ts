import { toBuyerStatusType } from "./buyer-status.mapper"

describe("toBuyerStatusType", () => {
    it("maps the buyer status to the GraphQL type", () => {
        expect(toBuyerStatusType({ personId: "p-1", hasOrders: true })).toEqual({ personId: "p-1", hasOrders: true })
    })
})
