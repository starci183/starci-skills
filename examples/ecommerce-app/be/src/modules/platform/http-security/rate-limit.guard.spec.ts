import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import type { ThrottlerStorage } from "@nestjs/throttler"
import { mock } from "@starci/jest-preset"
import { HttpSecurityErrorCode } from "./errors/http-security.error"
import type { OperationRequest } from "./http-security.contracts"
import type { RateLimitOptions } from "./http-security.options"
import { RateLimit, RateLimitGuard, RateTier, throttlerOptionsOf } from "./rate-limit.guard"

const rateLimit: RateLimitOptions = { windowMs: 60_000, defaultLimit: 100, strictLimit: 10 }

class Door {}

const defaultHandler = (): void => undefined
const strictHandler = (): void => undefined
RateLimit(RateTier.Strict)(strictHandler)

const contextOf = (handler = defaultHandler) => {
    const request: OperationRequest = { headers: { "user-agent": "spec" }, method: "GET", ip: "127.0.0.1" }
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(handler)
    context.getClass.mockReturnValue(Door)
    context.getType.mockReturnValue("http")
    context.switchToHttp.mockReturnValue(http)
    return context
}

const build = async () => {
    const storage = mock<ThrottlerStorage>()
    const reflector = mock<Reflector>()
    const guard = new RateLimitGuard(throttlerOptionsOf(rateLimit), storage, reflector)
    await guard.onModuleInit()
    return { guard, storage }
}

const configuredTiers = () => {
    const options = throttlerOptionsOf(rateLimit)
    if (Array.isArray(options)) throw new Error("expected named throttler options")
    const [defaultTier, strictTier] = options.throttlers
    if (defaultTier === undefined || strictTier === undefined) throw new Error("expected both rate tiers")
    return { options, defaultTier, strictTier }
}

describe("rate limiting", () => {
    it("builds one isolated window for each rate tier and disables response headers", () => {
        const { options, defaultTier, strictTier } = configuredTiers()

        expect(options.setHeaders).toBe(false)
        expect(defaultTier).toMatchObject({ name: RateTier.Default, ttl: 60_000, limit: 100 })
        expect(strictTier).toMatchObject({ name: RateTier.Strict, ttl: 60_000, limit: 10 })
    })

    it("selects the default tier when neither the handler nor its class declares one", () => {
        const { defaultTier, strictTier } = configuredTiers()
        const context = contextOf()

        expect(defaultTier.skipIf?.(context)).toBe(false)
        expect(strictTier.skipIf?.(context)).toBe(true)
    })

    it("selects a tier declared on the class", () => {
        class StrictDoor {}
        RateLimit(RateTier.Strict)(StrictDoor)
        const { defaultTier, strictTier } = configuredTiers()
        const context = contextOf()
        context.getClass.mockReturnValue(StrictDoor)

        expect(defaultTier.skipIf?.(context)).toBe(true)
        expect(strictTier.skipIf?.(context)).toBe(false)
    })

    it("lets handler metadata override class metadata", () => {
        class StrictDoor {}
        const handler = (): void => undefined
        RateLimit(RateTier.Strict)(StrictDoor)
        RateLimit(RateTier.Default)(handler)
        const { defaultTier, strictTier } = configuredTiers()
        const context = contextOf(handler)
        context.getClass.mockReturnValue(StrictDoor)

        expect(defaultTier.skipIf?.(context)).toBe(false)
        expect(strictTier.skipIf?.(context)).toBe(true)
    })

    it("counts the caller address and headers in the default tier", async () => {
        const { guard, storage } = await build()
        storage.increment.mockResolvedValue({
            totalHits: 1,
            timeToExpire: 30_000,
            isBlocked: false,
            timeToBlockExpire: 0,
        })

        await expect(guard.canActivate(contextOf())).resolves.toBe(true)

        expect(storage.increment).toHaveBeenCalledWith(expect.any(String), 60_000, 100, 60_000, RateTier.Default)
    })

    it("reports a blocked strict-tier caller as rate limited", async () => {
        const { guard, storage } = await build()
        storage.increment.mockResolvedValue({
            totalHits: 11,
            timeToExpire: 30_000,
            isBlocked: true,
            timeToBlockExpire: 30_000,
        })

        await expect(guard.canActivate(contextOf(strictHandler))).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RateLimited,
        })

        expect(storage.increment).toHaveBeenCalledWith(expect.any(String), 60_000, 10, 60_000, RateTier.Strict)
    })
})
