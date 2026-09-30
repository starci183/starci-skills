import { cacheKeyText, defineCacheKey } from "./cache-key.mapper"

const KEY = defineCacheKey<string>({
    name: "sample.token",
    ttl: { seconds: 60 },
    store: "redis",
    parse: (stored) => (typeof stored === "string" ? stored : null),
})

describe("cacheKeyText", () => {
    it("joins the key name and its arguments", () => {
        expect(cacheKeyText({ key: KEY, args: ["a", "b"] })).toBe("sample.token:a:b")
    })

    it("is the bare name when there are no arguments", () => {
        expect(cacheKeyText({ key: KEY, args: [] })).toBe("sample.token")
    })
})

describe("defineCacheKey", () => {
    it("returns the declaration unchanged", () => {
        expect(KEY.ttl).toEqual({ seconds: 60 })
        expect(KEY.parse(3)).toBeNull()
        expect(KEY.parse("x")).toBe("x")
    })
})
