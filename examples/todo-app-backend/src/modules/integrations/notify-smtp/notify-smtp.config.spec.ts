import { EnvSource } from "@modules/platform/config"
import { parseNotifySmtpConfig } from "./notify-smtp.config"

const base = { SMTP_HOST: "smtp.test", SMTP_PORT: "2525", SMTP_FROM: "notify@todo.test" }

describe("parseNotifySmtpConfig", () => {
    it("reads the host, the port and the sender and applies the tunable silences", () => {
        expect(parseNotifySmtpConfig(new EnvSource(base))).toEqual({
            host: "smtp.test",
            port: 2525,
            from: "notify@todo.test",
            connectTimeoutMs: 5_000,
            commandTimeoutMs: 10_000,
        })
    })

    it("reads declared silences as durations", () => {
        const options = parseNotifySmtpConfig(
            new EnvSource({ ...base, SMTP_CONNECT_TIMEOUT: "2s", SMTP_COMMAND_TIMEOUT: "500ms" }),
        )
        expect(options).toMatchObject({ connectTimeoutMs: 2_000, commandTimeoutMs: 500 })
    })

    it("refuses a missing host instead of falling back to one", () => {
        expect(() => parseNotifySmtpConfig(new EnvSource({ SMTP_PORT: "25", SMTP_FROM: "a@b.c" }))).toThrow("CONFIG_KEY_MISSING")
    })

    it("refuses a port that is not a number", () => {
        expect(() => parseNotifySmtpConfig(new EnvSource({ ...base, SMTP_PORT: "submission" }))).toThrow("CONFIG_KEY_INVALID")
    })
})
