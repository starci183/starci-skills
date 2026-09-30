import type { ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { FakeClock } from "@starci/jest-preset/clock"
import { mock } from "@starci/jest-preset/mock"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { RateLimitGuard, RateTier } from "./rate-limit.guard"

const options = { allowedOrigins: [], rateLimit: { windowMs: 1000, defaultLimit: 2, strictLimit: 1 } }

const contextOf = (ip: string): ExecutionContext =>
    mock<ExecutionContext>({
        getType: jest.fn().mockReturnValue("http"),
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({ getRequest: () => ({ ip }) }),
    })

const guardWith = (tier: RateTier | undefined, clock: FakeClock): RateLimitGuard =>
    new RateLimitGuard(mock<Reflector>({ getAllAndOverride: jest.fn().mockReturnValue(tier) }), clock, options)

const thrownCode = (call: () => unknown): string | undefined => {
    try {
        call()
    } catch (error) {
        return error instanceof HttpSecurityError ? error.code : String(error)
    }
    return undefined
}

describe("RateLimitGuard", () => {
    it("lets a caller through up to the limit of the default tier and refuses the next request", () => {
        const guard = guardWith(undefined, new FakeClock(0))
        expect(guard.canActivate(contextOf("1.1.1.1"))).toBe(true)
        expect(guard.canActivate(contextOf("1.1.1.1"))).toBe(true)
        expect(() => guard.canActivate(contextOf("1.1.1.1"))).toThrow(HttpSecurityError)
    })

    it("applies the tighter limit of the strict tier", () => {
        const guard = guardWith(RateTier.Strict, new FakeClock(0))
        expect(guard.canActivate(contextOf("2.2.2.2"))).toBe(true)
        expect(thrownCode(() => guard.canActivate(contextOf("2.2.2.2")))).toBe(HttpSecurityErrorCode.RateLimited)
    })

    it("counts callers separately and opens a new window when the old one has passed", () => {
        const clock = new FakeClock(0)
        const guard = guardWith(undefined, clock)
        guard.canActivate(contextOf("3.3.3.3"))
        guard.canActivate(contextOf("3.3.3.3"))
        expect(guard.canActivate(contextOf("4.4.4.4"))).toBe(true)
        clock.advance(1001)
        expect(guard.canActivate(contextOf("3.3.3.3"))).toBe(true)
    })
})
