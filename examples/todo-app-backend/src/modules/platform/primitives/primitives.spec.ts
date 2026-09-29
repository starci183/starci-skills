import {
    isRecord, sha256Hex,
} from "./index"

describe("platform primitives",
    () => {
        it("sha256Hex returns the known digest of a string",
            () => {
                expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
            })

        it("isRecord accepts objects and refuses null and scalars",
            () => {
                expect(isRecord({
                })).toBe(true)
                expect(isRecord(null)).toBe(false)
                expect(isRecord("text")).toBe(false)
                expect(isRecord(undefined)).toBe(false)
            })
    })
