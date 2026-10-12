import type { ExecutionContext } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { Reflector } from "@nestjs/core"
import { mock } from "@starci/jest-preset"
import type { Request } from "express"
import type { Principal } from "@modules/platform/cqrs"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { AuthGuard } from "./auth.guard"
import { IdentityErrorCode } from "./errors/identity.error"
import { PublicReason } from "./identity.contracts"
import { ACCESS_TOKEN_VERIFIER, PUBLIC_KEY } from "./identity.decorators"

class Door {}

const handler = (): void => undefined

const principal: Principal = { id: "person-1", role: "authenticated" }

const build = async (authorization?: string) => {
    const reflector = mock<Reflector>()
    const verify = jest.fn<Promise<Outcome<Principal, string>>, [token: string]>()
    const request = mock<Request>({
        headers: authorization === undefined ? {} : { authorization },
        principal: undefined,
    })
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(handler)
    context.getClass.mockReturnValue(Door)
    context.switchToHttp.mockReturnValue(http)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuthGuard,
            { provide: Reflector, useValue: reflector },
            { provide: ACCESS_TOKEN_VERIFIER, useValue: verify },
        ],
    }).compile()
    return { guard: moduleRef.get(AuthGuard), context, reflector, verify, request }
}

describe("AuthGuard", () => {
    it("opens a door carrying public metadata without authenticating", async () => {
        const { guard, context, reflector, verify } = await build("Bearer access-token")
        reflector.getAllAndOverride.mockReturnValue({ reason: PublicReason.Health })

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PUBLIC_KEY, [handler, Door])
        expect(verify).not.toHaveBeenCalled()
    })

    it.each([undefined, "Basic credentials", "Bearer", "Bearer  access-token", "Bearer access-token extra"])(
        "refuses an absent or malformed bearer credential (%s)",
        async (authorization) => {
            const { guard, context, reflector, verify } = await build(authorization)
            reflector.getAllAndOverride.mockReturnValue(undefined)

            await expect(guard.canActivate(context)).rejects.toMatchObject({
                code: IdentityErrorCode.Unauthenticated,
            })

            expect(verify).not.toHaveBeenCalled()
        },
    )

    it("refuses a bearer token the verifier rejects", async () => {
        const { guard, context, reflector, verify, request } = await build("Bearer access-token")
        reflector.getAllAndOverride.mockReturnValue(undefined)
        verify.mockResolvedValue(refused("SUPABASE_ACCESS_TOKEN_INVALID"))

        await expect(guard.canActivate(context)).rejects.toMatchObject({
            code: IdentityErrorCode.Unauthenticated,
        })

        expect(verify).toHaveBeenCalledWith("access-token")
        expect(request.principal).toBeUndefined()
    })

    it("stamps the verified principal on the request, whatever the letter case of the scheme", async () => {
        const { guard, context, reflector, verify, request } = await build("bearer access-token")
        reflector.getAllAndOverride.mockReturnValue(undefined)
        verify.mockResolvedValue(ok(principal))

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(verify).toHaveBeenCalledWith("access-token")
        expect(request.principal).toEqual(principal)
    })
})
