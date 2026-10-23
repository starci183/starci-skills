import type { ExecutionContext } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { Reflector } from "@nestjs/core"
import { mock } from "@starci/jest-preset"
import type { Request } from "express"
import type { Principal } from "@modules/platform/cqrs"
import type { Outcome } from "@modules/platform/primitives"
import { ok, refused } from "@modules/platform/primitives"
import { AuthGuard } from "./auth.guard"
import type { CredentialMetadata, CredentialPrincipal } from "./credential.contracts"
import { IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"
import { ACCESS_TOKEN_VERIFIER, CREDENTIAL_KEY, PUBLIC_KEY } from "./identity.decorators"

class Door {}

const handler = (): void => undefined

const principal: Principal = { id: "person-1", role: "authenticated" }
const credentialPrincipal: CredentialPrincipal = { kind: "api-key", subject: "key-1", workspaceId: "ws-1" }

interface AccessTokenVerifier {
    verify(token: string): Promise<Outcome<Principal, string>>
}

interface DoorMetadata {
    readonly credential?: CredentialMetadata
    readonly metadata?: PublicMetadata
    readonly credentialPrincipal?: CredentialPrincipal
}

/** The slice of the request the guard reads; an absent principal is an explicit undefined, never a mock function. */
interface GuardRequest {
    headers: Request["headers"]
    principal: Principal | undefined
    credentialPrincipal: CredentialPrincipal | undefined
}

const build = async (authorization?: string, door: DoorMetadata = {}) => {
    const reflector = mock<Reflector>()
    reflector.getAllAndOverride.mockImplementation((key: unknown) =>
        key === CREDENTIAL_KEY ? door.credential : key === PUBLIC_KEY ? door.metadata : undefined,
    )
    const verifier = mock<AccessTokenVerifier>()
    const verify = verifier.verify
    const request = mock<GuardRequest>({
        headers: authorization === undefined ? {} : { authorization },
        principal: undefined,
        credentialPrincipal: door.credentialPrincipal,
    })
    const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    http.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(handler)
    context.getClass.mockReturnValue(Door)
    context.getType.mockReturnValue("http")
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
        const { guard, context, reflector, verify } = await build("Bearer access-token", {
            metadata: { reason: PublicReason.Health },
        })

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PUBLIC_KEY, [handler, Door])
        expect(verify).not.toHaveBeenCalled()
    })

    it("opens a credential door with the matching principal without verifying a session", async () => {
        const { guard, context, verify, request } = await build("Bearer credential-token", {
            credential: { kind: "api-key" },
            credentialPrincipal,
        })

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(verify).not.toHaveBeenCalled()
        expect(request.principal).toBeUndefined()
    })

    it("refuses a credential door without its principal even with public metadata and a session token", async () => {
        const { guard, context, verify } = await build("Bearer access-token", {
            credential: { kind: "api-key" },
            metadata: { reason: PublicReason.Health },
        })
        verify.mockResolvedValue(ok(principal))

        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Unauthenticated })

        expect(verify).not.toHaveBeenCalled()
    })

    it("refuses a credential principal of another kind", async () => {
        const { guard, context, verify } = await build(undefined, {
            credential: { kind: "tool-token" },
            credentialPrincipal,
        })

        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Unauthenticated })

        expect(verify).not.toHaveBeenCalled()
    })
})

describe("AuthGuard session authentication", () => {
    it.each([undefined, "Basic credentials", "Bearer", "Bearer  access-token", "Bearer access-token extra"])(
        "refuses an absent or malformed bearer credential (%s)",
        async (authorization) => {
            const { guard, context, verify } = await build(authorization)

            await expect(guard.canActivate(context)).rejects.toMatchObject({
                code: IdentityErrorCode.Unauthenticated,
            })

            expect(verify).not.toHaveBeenCalled()
        },
    )

    it("refuses a bearer token the verifier rejects", async () => {
        const { guard, context, verify, request } = await build("Bearer access-token")
        verify.mockResolvedValue(refused("SUPABASE_ACCESS_TOKEN_INVALID"))

        await expect(guard.canActivate(context)).rejects.toMatchObject({
            code: IdentityErrorCode.Unauthenticated,
        })

        expect(verify).toHaveBeenCalledWith("access-token")
        expect(request.principal).toBeUndefined()
    })

    it("stamps the verified principal on the request, whatever the letter case of the scheme", async () => {
        const { guard, context, verify, request } = await build("bearer access-token")
        verify.mockResolvedValue(ok(principal))

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(verify).toHaveBeenCalledWith("access-token")
        expect(request.principal).toEqual(principal)
    })
})
