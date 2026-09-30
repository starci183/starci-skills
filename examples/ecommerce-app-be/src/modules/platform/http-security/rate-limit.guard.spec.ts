import type { ExecutionContext } from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import { ThrottlerStorageService } from "@nestjs/throttler"
import type { ThrottlerModuleOptions } from "@nestjs/throttler"
import { mock } from "@starci/jest-preset/mock"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { RateLimit, RateLimitGuard, RateTier, throttlerOptionsOf } from "./rate-limit.guard"

const rateLimit = { windowMs: 60_000, defaultLimit: 2, strictLimit: 1 }

/** A door: a handler that carries `tier` when it is given one. */
const doorOf = (tier?: RateTier): (() => void) => {
    const handler = (): void => undefined
    if (tier !== undefined) RateLimit(tier)(handler, "handler", { value: handler })
    return handler
}

const contextOf = (ip: string, handler: () => void): ExecutionContext =>
    mock<ExecutionContext>({
        getType: jest.fn().mockReturnValue("http"),
        getHandler: jest.fn().mockReturnValue(handler),
        getClass: jest.fn().mockReturnValue(class Door {}),
        switchToHttp: jest.fn().mockReturnValue({ getRequest: () => ({ ip, headers: {} }) }),
    })

const skipsOf = (options: ThrottlerModuleOptions, context: ExecutionContext): Array<boolean> => {
    if (Array.isArray(options)) return []
    return options.throttlers.map((throttler) => throttler.skipIf?.(context) ?? false)
}

describe("throttlerOptionsOf", () => {
    it("counts a plain door in the default window only", () => {
        expect(skipsOf(throttlerOptionsOf(rateLimit), contextOf("1.1.1.1", doorOf()))).toEqual([false, true])
    })

    it("counts a strict door in the strict window only", () => {
        expect(skipsOf(throttlerOptionsOf(rateLimit), contextOf("1.1.1.1", doorOf(RateTier.Strict)))).toEqual([
            true,
            false,
        ])
    })
})

describe("RateLimitGuard", () => {
    const storage = new ThrottlerStorageService()
    const guard = new RateLimitGuard(
        throttlerOptionsOf(rateLimit),
        storage,
        mock<Reflector>({ getAllAndOverride: jest.fn() }),
    )

    beforeAll(async () => {
        await guard.onModuleInit()
    })

    afterAll(() => {
        storage.onApplicationShutdown()
    })

    it("lets a caller through up to the limit of the default tier and refuses the next request with RateLimited", async () => {
        const door = doorOf()
        await expect(guard.canActivate(contextOf("2.2.2.2", door))).resolves.toBe(true)
        await expect(guard.canActivate(contextOf("2.2.2.2", door))).resolves.toBe(true)
        await expect(guard.canActivate(contextOf("2.2.2.2", door))).rejects.toThrow(
            new HttpSecurityError({ code: HttpSecurityErrorCode.RateLimited }),
        )
    })

    it("applies the tighter limit of the strict tier and counts callers separately", async () => {
        const door = doorOf(RateTier.Strict)
        await expect(guard.canActivate(contextOf("3.3.3.3", door))).resolves.toBe(true)
        await expect(guard.canActivate(contextOf("3.3.3.3", door))).rejects.toBeInstanceOf(HttpSecurityError)
        await expect(guard.canActivate(contextOf("4.4.4.4", door))).resolves.toBe(true)
    })
})
