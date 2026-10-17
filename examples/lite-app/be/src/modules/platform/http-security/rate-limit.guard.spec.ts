import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import { builder, FakeClock, mock } from "@starci/jest-preset"
import type { Request } from "express"
import { CLOCK } from "@modules/platform/clock"
import { HttpSecurityErrorCode } from "./errors/http-security.error"
import { HTTP_SECURITY_OPTIONS } from "./http-security.decorators"
import type { HttpSecurityOptions } from "./http-security.options"
import { RateLimit, RateLimitGuard, RateTier } from "./rate-limit.guard"

const options: HttpSecurityOptions = {
    allowedOrigins: [],
    rateLimit: { windowMs: 60_000, defaultLimit: 3, strictLimit: 1 },
    webhooks: {},
}

class Door {}

const defaultHandler = (): void => undefined
const strictHandler = (): void => undefined
RateLimit(RateTier.Strict)(strictHandler)

const build = async (handler = defaultHandler) => {
    const clock = new FakeClock("2026-10-01T00:00:00.000Z")
    let ip: string | undefined = "127.0.0.1"
    const callFrom = (address: string | undefined): void => {
        ip = address
    }
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockImplementation(() => mock<Request>({ ip }))
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(handler)
    context.getClass.mockReturnValue(Door)
    context.switchToHttp.mockReturnValue(http)
    const moduleRef = await Test.createTestingModule({
        providers: [
            RateLimitGuard,
            Reflector,
            { provide: CLOCK, useValue: clock },
            { provide: HTTP_SECURITY_OPTIONS, useValue: builder<HttpSecurityOptions>(options)() },
        ],
    }).compile()
    return { guard: moduleRef.get(RateLimitGuard), context, clock, callFrom }
}

const refusalOf = (action: () => boolean): unknown => {
    try {
        return action()
    } catch (error) {
        return error
    }
}

describe("RateLimitGuard", () => {
    it("lets a caller through up to the default limit of the window and refuses the next request", async () => {
        const { guard, context } = await build()

        expect([guard.canActivate(context), guard.canActivate(context), guard.canActivate(context)]).toEqual([
            true,
            true,
            true,
        ])
        expect(refusalOf(() => guard.canActivate(context))).toMatchObject({
            code: HttpSecurityErrorCode.RateLimited,
        })
    })

    it("applies the strict limit to a door marked strict", async () => {
        const { guard, context } = await build(strictHandler)

        expect(guard.canActivate(context)).toBe(true)
        expect(refusalOf(() => guard.canActivate(context))).toMatchObject({
            code: HttpSecurityErrorCode.RateLimited,
        })
    })

    it("counts each caller address on its own, an absent address as one unknown caller", async () => {
        const { guard, context, callFrom } = await build()
        for (let request = 0; request < 3; request += 1) guard.canActivate(context)

        callFrom("10.0.0.2")
        expect(guard.canActivate(context)).toBe(true)
        callFrom(undefined)
        expect([guard.canActivate(context), guard.canActivate(context), guard.canActivate(context)]).toEqual([
            true,
            true,
            true,
        ])
        expect(refusalOf(() => guard.canActivate(context))).toMatchObject({
            code: HttpSecurityErrorCode.RateLimited,
        })
    })

    it("starts a new window once the previous one has ended", async () => {
        const { guard, context, clock } = await build()
        for (let request = 0; request < 3; request += 1) guard.canActivate(context)

        clock.advance(60_000)

        expect(guard.canActivate(context)).toBe(true)
    })

    it("prunes ended windows when the table is full and keeps counting live ones", async () => {
        const { guard, context, clock, callFrom } = await build()
        for (let request = 0; request < 3; request += 1) guard.canActivate(context)
        clock.advance(60_000)
        for (let address = 0; address < 10_000; address += 1) {
            callFrom(`10.1.${Math.floor(address / 256)}.${address % 256}`)
            guard.canActivate(context)
        }

        callFrom("10.1.0.0")
        expect([guard.canActivate(context), guard.canActivate(context)]).toEqual([true, true])
        expect(refusalOf(() => guard.canActivate(context))).toMatchObject({
            code: HttpSecurityErrorCode.RateLimited,
        })
        callFrom("127.0.0.1")
        expect(guard.canActivate(context)).toBe(true)
    })
})
