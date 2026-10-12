import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import type { Principal } from "@modules/platform/cqrs"
import { ok, refused } from "@modules/platform/primitives"
import { SUPABASE_ACCESS_TOKEN_VERIFIER, SupabaseErrorCode } from "@modules/integrations/supabase"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import { AuthGuard } from "./auth.guard"
import { IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

const principal: Principal = { id: "user-1", role: "authenticated" }

const build = async (metadata: PublicMetadata | undefined, verify: VerifySupabaseAccessToken) => {
    const reflector = mock<Reflector>()
    reflector.getAllAndOverride.mockReturnValue(metadata)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuthGuard,
            { provide: Reflector, useValue: reflector },
            { provide: SUPABASE_ACCESS_TOKEN_VERIFIER, useValue: verify },
        ],
    }).compile()
    return moduleRef.get(AuthGuard)
}

const contextOf = (authorization: string | undefined) => {
    const request = mock<Request>()
    request.headers = authorization === undefined ? {} : { authorization }
    request.principal = undefined
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(() => undefined)
    context.getClass.mockReturnValue(class Door {})
    context.switchToHttp.mockReturnValue(http)
    return { context, request }
}

const unauthenticated = expect.objectContaining({ code: IdentityErrorCode.Unauthenticated })

describe("AuthGuard", () => {
    it("lets a public door through without reading a token", async () => {
        const verify = jest.fn<ReturnType<VerifySupabaseAccessToken>, Parameters<VerifySupabaseAccessToken>>()
        const guard = await build({ reason: PublicReason.Health }, verify)
        const { context } = contextOf("Bearer token")

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(verify).not.toHaveBeenCalled()
    })

    it("admits a door that is not public for a verified bearer token and records the principal on the request", async () => {
        const verify = jest.fn<ReturnType<VerifySupabaseAccessToken>, Parameters<VerifySupabaseAccessToken>>()
        verify.mockResolvedValue(ok(principal))
        const guard = await build(undefined, verify)
        const { context, request } = contextOf("Bearer signed-token")

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(verify).toHaveBeenCalledWith("signed-token")
        expect(request.principal).toEqual(principal)
    })

    it("refuses a door that is not public when the token fails verification", async () => {
        const verify = jest.fn<ReturnType<VerifySupabaseAccessToken>, Parameters<VerifySupabaseAccessToken>>()
        verify.mockResolvedValue(refused(SupabaseErrorCode.AccessTokenInvalid))
        const guard = await build(undefined, verify)
        const { context, request } = contextOf("bearer forged-token")

        await expect(guard.canActivate(context)).rejects.toThrow(unauthenticated)

        expect(request.principal).toBeUndefined()
    })

    it.each([
        ["no authorization header", undefined],
        ["another scheme", "Basic dXNlcjpwYXNz"],
        ["a scheme without a token", "Bearer"],
        ["a token followed by more text", "Bearer one two"],
    ])("refuses a door that is not public with %s, without calling the verifier", async (_label, authorization) => {
        const verify = jest.fn<ReturnType<VerifySupabaseAccessToken>, Parameters<VerifySupabaseAccessToken>>()
        const guard = await build(undefined, verify)
        const { context } = contextOf(authorization)

        await expect(guard.canActivate(context)).rejects.toThrow(unauthenticated)

        expect(verify).not.toHaveBeenCalled()
    })
})
