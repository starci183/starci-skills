import { ConfigErrorCode } from "@modules/platform/config"
import { allowedOriginsOf, trustProxyOf } from "./http-security.policy"

describe("HTTP security policy", () => {
    it("accepts exact HTTPS and local development origins", () => {
        expect(allowedOriginsOf("https://app.test, http://localhost:3000")).toEqual([
            "https://app.test",
            "http://localhost:3000",
        ])
    })

    it.each([
        "*",
        "https://*.app.test",
        ",",
        "https://app.test/",
        "https://app.test/path",
        "http://app.test",
        "https://user:pass@app.test",
    ])("refuses an unsafe browser origin %s", (origin) => {
        expect(() => allowedOriginsOf(origin)).toThrow(
            expect.objectContaining({
                code: ConfigErrorCode.KeyInvalid,
                params: { key: "HTTP_SECURITY_ALLOWED_ORIGINS" },
            }),
        )
    })

    it("accepts a direct host and an explicitly declared proxy hop count", () => {
        expect(trustProxyOf(0)).toBe(0)
        expect(trustProxyOf(1)).toBe(1)
    })

    it.each([-1, 11, Number.NaN, 1.5])("refuses invalid proxy hop count %s", (hops) => {
        expect(() => trustProxyOf(hops)).toThrow(
            expect.objectContaining({
                code: ConfigErrorCode.KeyInvalid,
                params: { key: "HTTP_SECURITY_TRUST_PROXY" },
            }),
        )
    })
})
