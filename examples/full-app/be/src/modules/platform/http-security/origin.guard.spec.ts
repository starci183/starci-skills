import type { ExecutionContext } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HttpSecurityErrorCode } from "./errors/http-security.error"
import { HTTP_SECURITY_OPTIONS } from "./http-security.decorators"
import type { OperationRequest } from "./http-security.contracts"
import type { HttpSecurityOptions } from "./http-security.options"
import { OriginGuard } from "./origin.guard"

const options: HttpSecurityOptions = {
    allowedOrigins: ["https://app.test"],
    rateLimit: { windowMs: 60_000, defaultLimit: 100, strictLimit: 10 },
    webhooks: {},
}

const build = async (method: string, headers: OperationRequest["headers"]) => {
    const request: OperationRequest = { headers, method, ip: "127.0.0.1" }
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getType.mockReturnValue("http")
    context.switchToHttp.mockReturnValue(http)
    const moduleRef = await Test.createTestingModule({
        providers: [OriginGuard, { provide: HTTP_SECURITY_OPTIONS, useValue: options }],
    }).compile()
    return { guard: moduleRef.get(OriginGuard), context }
}

describe("OriginGuard", () => {
    it.each(["GET", "HEAD", "OPTIONS"])("allows the safe %s method regardless of origin", async (method) => {
        const { guard, context } = await build(method, { origin: "https://foreign.test" })

        expect(guard.canActivate(context)).toBe(true)
    })

    it.each([{}, { referer: "not a URL" }])(
        "allows a state-changing non-browser request without a usable origin (%o)",
        async (headers) => {
            const { guard, context } = await build("POST", headers)

            expect(guard.canActivate(context)).toBe(true)
        },
    )

    it("allows a state-changing request carrying an allowed Origin header", async () => {
        const { guard, context } = await build("POST", { origin: "https://app.test" })

        expect(guard.canActivate(context)).toBe(true)
    })

    it("uses the origin of an allowed Referer URL", async () => {
        const { guard, context } = await build("PATCH", { referer: "https://app.test/orders/one" })

        expect(guard.canActivate(context)).toBe(true)
    })

    it("refuses a state-changing request from an origin outside the allowlist", async () => {
        const { guard, context } = await build("DELETE", { origin: "https://foreign.test" })

        expect(() => guard.canActivate(context)).toThrow(
            expect.objectContaining({ code: HttpSecurityErrorCode.OriginRejected }),
        )
    })
})
