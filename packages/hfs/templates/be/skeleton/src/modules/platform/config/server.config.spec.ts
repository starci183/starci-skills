import { EnvSource } from "./env-source"
import { ConfigError } from "./errors/config.error"
import { parseServerConfig } from "./server.config"

describe("parseServerConfig", () => {
    it("falls back to port 3000 when PORT is unset", () => {
        expect(parseServerConfig(EnvSource.of({}))).toEqual({ port: 3000 })
    })

    it("accepts an integer PORT inside the TCP range", () => {
        expect(parseServerConfig(EnvSource.of({ PORT: "8080" }))).toEqual({ port: 8080 })
    })

    it.each(["80a", "0", "70000", "1.5"])("refuses PORT=%s by naming the key only", (port) => {
        const failure = () => parseServerConfig(EnvSource.of({ PORT: port }))
        expect(failure).toThrow(ConfigError)
        expect(failure).toThrow("Configuration key PORT does not hold a valid value.")
    })
})
