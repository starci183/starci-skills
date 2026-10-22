import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import { ThrottlerStorage } from "@nestjs/throttler"
import { mock } from "@starci/jest-preset"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import type { OperationRequest } from "./http-security.contracts"
import { HTTP_SECURITY_OPTIONS } from "./http-security.decorators"
import type { RateLimitOptions } from "./http-security.options"
import { RateLimit, RateLimitGuard, RateTier, serviceTrackerOf, throttlerOptionsOf } from "./rate-limit.guard"

const rateLimit: RateLimitOptions = { windowMs: 60_000, defaultLimit: 100, strictLimit: 10, serviceLimit: 1000 }

class Door {}

const defaultHandler = (): void => undefined
const strictHandler = (): void => undefined
RateLimit(RateTier.Strict)(strictHandler)
const serviceHandler = (): void => undefined
RateLimit(RateTier.Service)(serviceHandler)

const contextOf = (handler = defaultHandler, authorization?: string) => {
    const request: OperationRequest = {
        headers: { "user-agent": "spec", ...(authorization === undefined ? {} : { authorization }) },
        method: "GET",
        ip: "127.0.0.1",
    }
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
    const moduleRef = await Test.createTestingModule({
        providers: [
            RateLimitGuard,
            { provide: HTTP_SECURITY_OPTIONS, useValue: { allowedOrigins: [], rateLimit, webhooks: {} } },
            { provide: ThrottlerStorage, useValue: storage },
            { provide: Reflector, useValue: reflector },
        ],
    }).compile()
    const guard = moduleRef.get(RateLimitGuard)
    await guard.onModuleInit()
    return { guard, storage }
}

const configuredTiers = () => {
    const options = throttlerOptionsOf(rateLimit)
    if (Array.isArray(options)) {
        throw new HttpSecurityError({ code: HttpSecurityErrorCode.RequestInvalid })
    }
    const [defaultTier, strictTier, serviceTier] = options.throttlers
    if (defaultTier === undefined || strictTier === undefined || serviceTier === undefined) {
        throw new HttpSecurityError({ code: HttpSecurityErrorCode.RequestInvalid })
    }
    return { options, defaultTier, strictTier, serviceTier }
}

const notBlocked = { totalHits: 1, timeToExpire: 30_000, isBlocked: false, timeToBlockExpire: 0 }

describe("rate limiting configuration", () => {
    it("builds one isolated window for each rate tier and disables response headers", () => {
        const { options, defaultTier, strictTier, serviceTier } = configuredTiers()

        expect(options.setHeaders).toBe(false)
        expect(defaultTier).toMatchObject({ name: RateTier.Default, ttl: 60_000, limit: 100 })
        expect(strictTier).toMatchObject({ name: RateTier.Strict, ttl: 60_000, limit: 10 })
        expect(serviceTier).toMatchObject({ name: RateTier.Service, ttl: 60_000, limit: 1000 })
        expect(serviceTier.getTracker).toBe(serviceTrackerOf)
    })

    it("counts a service door only in the service tier, never in the strict or default window", () => {
        const { defaultTier, strictTier, serviceTier } = configuredTiers()
        const service = contextOf(serviceHandler)
        const strict = contextOf(strictHandler)

        expect(serviceTier.skipIf?.(service)).toBe(false)
        expect(strictTier.skipIf?.(service)).toBe(true)
        expect(defaultTier.skipIf?.(service)).toBe(true)
        expect(serviceTier.skipIf?.(strict)).toBe(true)
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
})

describe("serviceTrackerOf", () => {
    it("keys one window per presented credential, whatever address the call comes from", () => {
        const order = serviceTrackerOf({ ip: "10.0.0.1", headers: { authorization: "Bearer order-key" } })

        expect(serviceTrackerOf({ ip: "10.0.0.2", headers: { authorization: "Bearer order-key" } })).toBe(order)
        expect(serviceTrackerOf({ ip: "10.0.0.1", headers: { authorization: "Bearer billing-key" } })).not.toBe(order)
    })

    it("never uses the credential itself as the storage key", () => {
        const tracker = serviceTrackerOf({ headers: { authorization: "Bearer order-key" } })

        expect(tracker).toMatch(/^service:[0-9a-f]{64}$/)
        expect(tracker).not.toContain("order-key")
    })

    it.each([
        { request: "no headers", value: {} },
        { request: "no authorization header", value: { headers: {} } },
        { request: "a non-string authorization", value: { headers: { authorization: ["Bearer order-key"] } } },
    ])("puts a call with $request into the one anonymous window", ({ value }) => {
        expect(serviceTrackerOf(value)).toBe(serviceTrackerOf({ headers: { authorization: "" } }))
    })
})

describe("RateLimitGuard", () => {
    it("counts the caller address and headers in the default tier", async () => {
        const { guard, storage } = await build()
        storage.increment.mockResolvedValue({
            totalHits: 1,
            timeToExpire: 30_000,
            isBlocked: false,
            timeToBlockExpire: 0,
        })

        await expect(guard.canActivate(contextOf())).resolves.toBe(true)

        expect(storage.increment).toHaveBeenCalledWith(
            "0b00b8b6c442506be1bada0d8f5696dadc90069be14e14294aacc2f1c125c3cd",
            60_000,
            100,
            60_000,
            RateTier.Default,
        )
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

        expect(storage.increment).toHaveBeenCalledWith(
            "6602faeeddb2889204203c4383ebd5c274b199ad11195b5f6ee65b8ddd99dc9e",
            60_000,
            10,
            60_000,
            RateTier.Strict,
        )
    })

    it("counts each calling service in its own service-tier window, at the service limit", async () => {
        const { guard, storage } = await build()
        storage.increment.mockResolvedValue(notBlocked)

        await expect(guard.canActivate(contextOf(serviceHandler, "Bearer order-key"))).resolves.toBe(true)
        await expect(guard.canActivate(contextOf(serviceHandler, "Bearer billing-key"))).resolves.toBe(true)

        expect(storage.increment).toHaveBeenCalledTimes(2)
        const [orderCall, billingCall] = storage.increment.mock.calls
        expect(orderCall?.slice(1)).toEqual([60_000, 1000, 60_000, RateTier.Service])
        expect(billingCall?.slice(1)).toEqual([60_000, 1000, 60_000, RateTier.Service])
        expect(orderCall?.[0]).not.toBe(billingCall?.[0])
    })

    it("reports a calling service past its own budget as rate limited", async () => {
        const { guard, storage } = await build()
        storage.increment.mockResolvedValue({
            ...notBlocked,
            totalHits: 1001,
            isBlocked: true,
            timeToBlockExpire: 30_000,
        })

        await expect(guard.canActivate(contextOf(serviceHandler, "Bearer order-key"))).rejects.toMatchObject({
            code: HttpSecurityErrorCode.RateLimited,
        })
    })
})
