import { EnvSource } from "@modules/platform/config"
import { parseSepayConfig } from "./sepay.config"

const declared = { SEPAY_BASE_URL: "https://my.sepay.test", SEPAY_API_KEY: "k", SEPAY_WEBHOOK_SECRET: "w" }

describe("parseSepayConfig", () => {
    it("reads the URL and both secrets, and defaults only the timeout", () => {
        const options = parseSepayConfig(new EnvSource(declared))
        expect(options.baseUrl).toBe("https://my.sepay.test")
        expect(options.apiKey.reveal()).toBe("k")
        expect(options.webhookSecret.reveal()).toBe("w")
        expect(options.timeoutMs).toBe(15_000)
    })

    it("reads the timeout tunable", () => {
        expect(parseSepayConfig(new EnvSource({ ...declared, SEPAY_TIMEOUT: "5s" })).timeoutMs).toBe(5000)
    })

    it("names the missing key instead of defaulting a URL or a secret", () => {
        expect(() => parseSepayConfig(new EnvSource({ ...declared, SEPAY_API_KEY: "" }))).toThrow()
        expect(() => parseSepayConfig(new EnvSource({ SEPAY_API_KEY: "k", SEPAY_WEBHOOK_SECRET: "w" }))).toThrow()
    })
})
