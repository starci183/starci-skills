import { EnvSource } from "./env-source.config"
import { ConfigError, ConfigErrorCode } from "./errors/config.error"

const source = (values: Record<string, string | undefined>): EnvSource => new EnvSource(values)

const codeOf = (read: () => unknown): string | undefined => {
    try {
        read()
    } catch (error) {
        if (error instanceof ConfigError) return error.code
    }
    return undefined
}

describe("EnvSource", () => {
    it("reads a declared string and names a missing key", () => {
        expect(source({ A: "x" }).string("A")).toBe("x")
        expect(codeOf(() => source({}).string("A"))).toBe(ConfigErrorCode.KeyMissing)
    })

    it("parses integers and rejects text", () => {
        expect(source({ N: "7" }).int("N")).toBe(7)
        expect(codeOf(() => source({ N: "seven" }).int("N"))).toBe(ConfigErrorCode.KeyInvalid)
    })

    it("applies a literal fallback only for an undeclared tunable", () => {
        expect(source({}).int("N", 3)).toBe(3)
        expect(source({ N: "9" }).int("N", 3)).toBe(9)
        expect(source({}).bool("B", true)).toBe(true)
    })

    it("parses booleans, urls, enums and durations", () => {
        expect(source({ B: "false" }).bool("B")).toBe(false)
        expect(source({ U: "http://localhost:1" }).url("U")).toBe("http://localhost:1")
        expect(codeOf(() => source({ U: "nope" }).url("U"))).toBe(ConfigErrorCode.KeyInvalid)
        expect(source({ E: "b" }).enum("E", ["a", "b"])).toBe("b")
        expect(codeOf(() => source({ E: "c" }).enum("E", ["a", "b"]))).toBe(ConfigErrorCode.KeyInvalid)
        expect(source({ D: "30s" }).duration("D")).toBe(30_000)
        expect(source({ D: "250" }).duration("D")).toBe(250)
    })

    it("hides a secret when serialized", () => {
        const secret = source({ S: "hunter2" }).secret("S")
        expect(secret.reveal()).toBe("hunter2")
        expect(JSON.stringify({ secret })).not.toContain("hunter2")
    })

    it("reports whether any key of an optional integration is declared", () => {
        expect(source({ A: "1" }).anyDeclared(["A", "B"])).toBe(true)
        expect(source({}).anyDeclared(["A", "B"])).toBe(false)
        expect(source({ A: "" }).optional("A")).toBeUndefined()
    })
})
