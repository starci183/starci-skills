import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { EnvSource } from "./env-source"
import { ConfigError } from "./errors/config.error"

describe("EnvSource", () => {
    it("reads a key and treats an empty value as unset", () => {
        const env = EnvSource.of({ PORT: "8080", EMPTY: "" })
        expect(env.optional("PORT")).toBe("8080")
        expect(env.optional("EMPTY")).toBeUndefined()
        expect(env.optional("ABSENT")).toBeUndefined()
    })

    it("refuses a missing required key by naming it", () => {
        const failure = () => EnvSource.of({}).required("DATABASE_URL")
        expect(failure).toThrow(ConfigError)
        expect(failure).toThrow("Configuration key DATABASE_URL is required and has no default.")
    })

    it("resolves <KEY>_FILE to the trimmed content of the file", () => {
        const dir = mkdtempSync(join(tmpdir(), "env-source-"))
        try {
            const path = join(dir, "token")
            writeFileSync(path, "value-from-file\n")
            expect(EnvSource.of({ API_TOKEN_FILE: path }).required("API_TOKEN")).toBe("value-from-file")
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    })

    it("names the _FILE key, not a path or a value, when the file cannot be read", () => {
        const failure = () => EnvSource.of({ API_TOKEN_FILE: join(tmpdir(), "no-such-dir", "token") }).optional("API_TOKEN")
        expect(failure).toThrow("Configuration key API_TOKEN_FILE points at a file that cannot be read.")
    })
})
