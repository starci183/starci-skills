import { toFence } from "./lease.rows"

describe("lease rows mapper", () => {
    it("reads the fencing token, which the driver returns as text, as a number", () => {
        expect(toFence({ fence: "42" })).toBe(42)
    })
})
