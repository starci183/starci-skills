import {
    isRecord
} from "./is-record"

describe("isRecord",
    () => {
        it("accepts objects and arrays",
            () => {
                expect(isRecord({
                })).toBe(true)
                expect(isRecord([])).toBe(true)
            })

        it("refuses null and every primitive",
            () => {
                for (const value of [null,
                    undefined,
                    "text",
                    1,
                    true]) {
                    expect(isRecord(value)).toBe(false)
                }
            })
    })
