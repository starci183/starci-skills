import type { ExecutionContext } from "@nestjs/common"
import { Reflector } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import type { Request } from "express"
import { mock } from "@starci/jest-preset"
import type { Principal } from "@modules/platform/cqrs"
import { ok, refused } from "@modules/platform/primitives"
import { SupabaseErrorCode } from "@modules/integrations/supabase"
import type { VerifySupabaseAccessToken } from "@modules/integrations/supabase"
import { AuthGuard } from "./auth.guard"
import type { CredentialMetadata, CredentialPrincipal } from "./credential.contracts"
import { IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"
import { ACCESS_TOKEN_VERIFIER, CREDENTIAL_KEY, PUBLIC_KEY } from "./identity.decorators"

const principal: Principal = { id: "user-1", role: "authenticated" }
const API_KEY: CredentialPrincipal = { kind: "api-key", subject: "key-1", workspaceId: "ws-1" }
const TOOL_TOKEN: CredentialPrincipal = { kind: "tool-token", subject: "tool-1", workspaceId: "ws-1" }

const build = async (metadata: PublicMetadata | undefined, credential?: CredentialMetadata) => {
    const verifier = mock<{ verify: VerifySupabaseAccessToken }>()
    const reflector = mock<Reflector>()
    reflector.getAllAndOverride.mockImplementation((key: unknown) => (key === CREDENTIAL_KEY ? credential : key === PUBLIC_KEY ? metadata : undefined))
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuthGuard,
            { provide: Reflector, useValue: reflector },
            { provide: ACCESS_TOKEN_VERIFIER, useFactory: () => verifier.verify },
        ],
    }).compile()
    return { guard: moduleRef.get(AuthGuard), verify: verifier.verify }
}

const contextOf = (authorization: string | undefined, credentialPrincipal?: CredentialPrincipal, sessionPrincipal?: Principal) => {
    const request = mock<Request>()
    request.headers = authorization === undefined ? {} : { authorization }
    request.principal = sessionPrincipal
    request.credentialPrincipal = credentialPrincipal
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(() => undefined)
    context.getClass.mockReturnValue(class Door {})
    context.getType.mockReturnValue("http")
    context.switchToHttp.mockReturnValue(http)
    return { context, request }
}

const unauthenticated = expect.objectContaining({ code: IdentityErrorCode.Unauthenticated })

describe("AuthGuard", () => {
    it("lets a public door through without reading a token", async () => {
        const { guard, verify } = await build({ reason: PublicReason.Health })
        const { context } = contextOf("Bearer token")

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(verify).not.toHaveBeenCalled()
    })

    it("admits a door that is not public for a verified bearer token and records the principal on the request", async () => {
        const { guard, verify } = await build(undefined)
        verify.mockResolvedValue(ok(principal))
        const { context, request } = contextOf("Bearer signed-token")

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(verify).toHaveBeenCalledWith("signed-token")
        expect(request.principal).toEqual(principal)
    })

    it("admits a credential door with the required principal without verifying a session token", async () => {
        const { guard, verify } = await build(undefined, { kind: "api-key" })
        verify.mockResolvedValue(ok(principal))
        const { context, request } = contextOf("Bearer signed-token", API_KEY)

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(verify).not.toHaveBeenCalled()
        expect(request.credentialPrincipal).toEqual(API_KEY)
        expect(request.principal).toBeUndefined()
    })

    it.each([
        { label: "missing", credentialPrincipal: undefined },
        { label: "of another kind", credentialPrincipal: TOOL_TOKEN },
    ])("refuses a credential door when its credential principal is $label, even with a valid session", async ({ credentialPrincipal }) => {
        const { guard, verify } = await build(undefined, { kind: "api-key" })
        verify.mockResolvedValue(ok(principal))
        const { context } = contextOf("Bearer signed-token", credentialPrincipal, principal)

        await expect(guard.canActivate(context)).rejects.toThrow(unauthenticated)

        expect(verify).not.toHaveBeenCalled()
    })

    it.each([
        { label: "missing", credentialPrincipal: undefined },
        { label: "of another kind", credentialPrincipal: TOOL_TOKEN },
    ])("refuses a credential door with public metadata when its credential principal is $label", async ({ credentialPrincipal }) => {
        const { guard, verify } = await build({ reason: PublicReason.Health }, { kind: "api-key" })
        const { context } = contextOf("Bearer signed-token", credentialPrincipal, principal)

        await expect(guard.canActivate(context)).rejects.toThrow(unauthenticated)

        expect(verify).not.toHaveBeenCalled()
    })

    it("refuses a door that is not public when the token fails verification", async () => {
        const { guard, verify } = await build(undefined)
        verify.mockResolvedValue(refused(SupabaseErrorCode.AccessTokenInvalid))
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
        const { guard, verify } = await build(undefined)
        const { context } = contextOf(authorization)

        await expect(guard.canActivate(context)).rejects.toThrow(unauthenticated)

        expect(verify).not.toHaveBeenCalled()
    })
})
