import { toTaskCountsType } from "./task-counts.mapper"

describe("task-counts mapper", () => {
    it("maps the counts to the type", () => {
        expect(toTaskCountsType({ open: 2, complete: 1 })).toEqual({ open: 2, complete: 1 })
    })
})
