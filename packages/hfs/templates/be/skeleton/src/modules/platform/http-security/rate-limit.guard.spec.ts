import "reflect-metadata"
import type { ExecutionContext, Type } from "@nestjs/common"
import type { Request } from "express"
import { Reflector } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { HttpSecurityErrorCode } from "./errors/http-security.error"
import { HTTP_SECURITY_OPTIONS } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"
import { RateLimit, RateLimitGuard, RateTier } from "./rate-limit.guard"

const AT = "2026-02-03T04:05:06.000Z"
const options: HttpSecurityOptions = {
    allowedOrigins: [],
    rateLimit: { windowMs: 60_000, defaultLimit: 2, strictLimit: 1 },
    webhooks: {},
}

const build = async (reflector: Reflector, clock: FakeClock) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            RateLimitGuard,
            { provide: Reflector, useValue: reflector },
            { provide: CLOCK, useValue: clock },
            { provide: HTTP_SECURITY_OPTIONS, useValue: options },
        ],
    }).compile()
    return moduleRef.get(RateLimitGuard)
}

/** An execution context of one POST from `ip` on the door; the handler and the class carry the tier metadata. */
const contextOf = (ip: string | undefined, handler = () => undefined, door: Type<unknown> = class Door {}) => {
    let address = ip
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockImplementation(() => mock<Request>({ headers: {}, method: "POST", ip: address }))
    const context = mock<ExecutionContext>()
    context.switchToHttp.mockReturnValue(http)
    context.getHandler.mockReturnValue(handler)
    context.getClass.mockReturnValue(door)
    return { context, setIp: (value: string | undefined) => (address = value) }
}

const RATE_LIMITED = expect.objectContaining({ code: HttpSecurityErrorCode.RateLimited })

describe("RateLimit", () => {
    it("marks a door with the tier it declares, and the guard counts it under that tier's limit", async () => {
        class Door {}
        RateLimit(RateTier.Strict)(Door)
        const guard = await build(new Reflector(), new FakeClock(AT))
        const { context } = contextOf("127.0.0.1", () => undefined, Door)

        expect(guard.canActivate(context)).toBe(true)
        expect(() => guard.canActivate(context)).toThrow(RATE_LIMITED)
    })
})

describe("RateLimitGuard", () => {
    it("counts an unmarked door under the default limit", async () => {
        const guard = await build(mock<Reflector>(), new FakeClock(AT))
        const { context } = contextOf("127.0.0.1")

        expect(guard.canActivate(context)).toBe(true)
        expect(guard.canActivate(context)).toBe(true)
        expect(() => guard.canActivate(context)).toThrow(RATE_LIMITED)
    })

    it("opens a fresh window for a caller whose bucket expired", async () => {
        const clock = new FakeClock(AT)
        const guard = await build(mock<Reflector>(), clock)
        const { context } = contextOf("127.0.0.1")

        guard.canActivate(context)
        guard.canActivate(context)
        expect(() => guard.canActivate(context)).toThrow(RATE_LIMITED)

        clock.advance(60_001)

        expect(guard.canActivate(context)).toBe(true)
    })

    it("counts a request without an address under the unknown bucket", async () => {
        const guard = await build(mock<Reflector>(), new FakeClock(AT))
        const { context } = contextOf(undefined)

        guard.canActivate(context)
        guard.canActivate(context)
        expect(() => guard.canActivate(context)).toThrow(RATE_LIMITED)
    })

    it("prunes the expired buckets when the map outgrows the bucket cap", async () => {
        const clock = new FakeClock(AT)
        const guard = await build(mock<Reflector>(), clock)
        const { context, setIp } = contextOf("0.0.0.0")

        for (let index = 0; index <= 10_000; index += 1) {
            setIp(`10.${(index >> 16) % 256}.${(index >> 8) % 256}.${index % 256}`)
            guard.canActivate(context)
        }

        clock.advance(60_001)
        setIp("127.0.0.1")

        expect(guard.canActivate(context)).toBe(true)
        expect(guard.canActivate(context)).toBe(true)
        expect(() => guard.canActivate(context)).toThrow(RATE_LIMITED)
    })
})
