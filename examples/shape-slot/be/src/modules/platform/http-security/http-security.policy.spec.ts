import { Test } from "@nestjs/testing"
import { ConfigErrorCode } from "@modules/platform/config"
import { allowedOriginsOf, trustProxyOf } from "./http-security.policy"

const SUBJECT = Symbol("subject")
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { allowedOriginsOf, trustProxyOf } }],
    }).compile()
    return moduleRef.get<typeof import("./http-security.policy")>(SUBJECT)
}

describe("HTTP security policy", () => {
    it("accepts exact HTTPS and local development origins", async () => {
        const subject = await build()
        expect(subject.allowedOriginsOf("https://app.test, http://localhost:3000")).toEqual([
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
    ])("refuses an unsafe browser origin %s", async (origin) => {
        const subject = await build()
        expect(() => subject.allowedOriginsOf(origin)).toThrow(
            expect.objectContaining({
                code: ConfigErrorCode.KeyInvalid,
                params: { key: "HTTP_SECURITY_ALLOWED_ORIGINS" },
            }),
        )
    })

    it("accepts a direct host and an explicitly declared proxy hop count", async () => {
        const subject = await build()
        expect(subject.trustProxyOf(0)).toBe(0)
        expect(subject.trustProxyOf(1)).toBe(1)
    })

    it.each([-1, 11, Number.NaN, 1.5])("refuses invalid proxy hop count %s", async (hops) => {
        const subject = await build()
        expect(() => subject.trustProxyOf(hops)).toThrow(
            expect.objectContaining({
                code: ConfigErrorCode.KeyInvalid,
                params: { key: "HTTP_SECURITY_TRUST_PROXY" },
            }),
        )
    })
})
