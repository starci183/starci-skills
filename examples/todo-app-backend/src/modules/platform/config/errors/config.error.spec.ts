import {
    ConfigError 
} from "./config.error"

describe("ConfigError",
    () => {
        it("names the key and the rule it broke, and carries a stable code",
            () => {
                const error = new ConfigError("CONFIG_KEY_MISSING",
                    "DATABASE_URL")

                expect(error.code).toBe("CONFIG_KEY_MISSING")
                expect(error.key).toBe("DATABASE_URL")
                expect(error.message).toBe("Configuration key DATABASE_URL is required and has no default.")
                expect(error.metadata).toEqual({
                    key: "DATABASE_URL" 
                })
            })

        it("keeps the underlying failure as the cause of an unreadable file",
            () => {
                const cause = new Error("ENOENT")
                const error = new ConfigError("CONFIG_FILE_UNREADABLE",
                    "SEPAY_API_KEY_FILE",
                    cause)

                expect(error.message).toBe("Configuration key SEPAY_API_KEY_FILE points at a file that cannot be read.")
                expect(error.cause).toBe(cause)
            })
    })
