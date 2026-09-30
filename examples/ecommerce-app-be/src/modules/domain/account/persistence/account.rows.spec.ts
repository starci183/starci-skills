import { toPersonId } from "./account.rows"

describe("toPersonId", () => {
    it("answers the id of the inserted row", () => {
        expect(toPersonId([{ id: "p-1" }])).toBe("p-1")
    })

    it("answers null when the insert produced no row", () => {
        expect(toPersonId([])).toBeNull()
    })
})
