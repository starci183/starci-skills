import { toExportMyDataType } from "./export-my-data.mapper"

const AT = new Date("2026-09-30T10:00:00.000Z")

describe("export-my-data mapper", () => {
    it("maps every exported line to a type and an empty export to an empty list", () => {
        expect(toExportMyDataType({ lines: [{ at: AT, action: "task.created", target: "t1" }] })).toEqual([
            { at: AT, action: "task.created", target: "t1" },
        ])
        expect(toExportMyDataType({ lines: [] })).toEqual([])
    })
})
