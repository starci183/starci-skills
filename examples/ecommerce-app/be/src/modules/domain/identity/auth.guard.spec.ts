import type { ExecutionContext } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { Reflector } from "@nestjs/core"
import { mock } from "@starci/jest-preset"
import type { Role } from "@modules/platform/cqrs"
import type { OperationRequest } from "@modules/platform/http-security"
import { AuthGuard } from "./auth.guard"
import type { CredentialMetadata, CredentialPrincipal } from "./credential.contracts"
import { IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata, SessionVerifier } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"
import { CREDENTIAL_KEY, PUBLIC_KEY, ROLES_KEY, SESSION_VERIFIER } from "./identity.decorators"

class Door {}

const handler = (): void => undefined

interface DoorMetadata {
    readonly credential?: CredentialMetadata
    readonly public?: PublicMetadata
    readonly roles?: ReadonlyArray<Role>
}

const build = async (authorization?: string, metadata: DoorMetadata = {}) => {
    const reflector = mock<Reflector>()
    reflector.getAllAndOverride.mockImplementation((key: unknown) => {
        if (key === CREDENTIAL_KEY) return metadata.credential
        if (key === PUBLIC_KEY) return metadata.public
        if (key === ROLES_KEY) return metadata.roles
        return undefined
    })
    const verifier = mock<SessionVerifier>()
    const request: OperationRequest & { credentialPrincipal?: CredentialPrincipal } = {
        headers: authorization === undefined ? {} : { authorization },
        method: "GET",
        ip: "127.0.0.1",
    }
    const host = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
    host.getRequest.mockReturnValue(request)
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(handler)
    context.getClass.mockReturnValue(Door)
    context.getType.mockReturnValue("http")
    context.switchToHttp.mockReturnValue(host)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuthGuard,
            { provide: Reflector, useValue: reflector },
            { provide: SESSION_VERIFIER, useValue: verifier },
        ],
    }).compile()
    return { guard: moduleRef.get(AuthGuard), context, reflector, verifier, request }
}

const registerPublicDoorTests = (): void => {
    it.each(Object.values(PublicReason))(
        "opens a door with the public reason %s without authenticating",
        async (reason) => {
            const { guard, context, reflector, verifier } = await build(undefined, { public: { reason } })

            await expect(guard.canActivate(context)).resolves.toBe(true)

            expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PUBLIC_KEY, [handler, Door])
            expect(verifier.verify).not.toHaveBeenCalled()
        },
    )

    it("requires authentication when public metadata has an unknown reason", async () => {
        const { guard, context, reflector, verifier } = await build()
        reflector.getAllAndOverride.mockImplementation((key: unknown) =>
            key === PUBLIC_KEY ? { reason: "tool-token" } : undefined,
        )

        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Unauthenticated })

        expect(verifier.verify).not.toHaveBeenCalled()
    })
}

const registerSessionAuthenticationTests = (): void => {
    it.each([undefined, "Basic credentials", "Bearer   "])(
        "refuses an absent or malformed bearer credential (%s)",
        async (authorization) => {
            const { guard, context, verifier } = await build(authorization)

            await expect(guard.canActivate(context)).rejects.toMatchObject({
                code: IdentityErrorCode.Unauthenticated,
            })

            expect(verifier.verify).not.toHaveBeenCalled()
        },
    )

    it("refuses a bearer token with no live session", async () => {
        const { guard, context, verifier } = await build("Bearer session-token")
        verifier.verify.mockResolvedValue(null)

        await expect(guard.canActivate(context)).rejects.toMatchObject({
            code: IdentityErrorCode.Unauthenticated,
        })

        expect(verifier.verify).toHaveBeenCalledWith("session-token")
    })

    it("stamps an authenticated member on a door with no role metadata", async () => {
        const { guard, context, reflector, verifier, request } = await build("Bearer session-token")
        verifier.verify.mockResolvedValue({ personId: "person-1" })

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [handler, Door])
        expect(request.principal).toEqual({ id: "person-1", roles: ["member"] })
    })
}

const registerRoleAuthorizationTests = (): void => {
    it("accepts a door whose required roles the principal has", async () => {
        const { guard, context, verifier, request } = await build("Bearer session-token", { roles: ["member"] })
        verifier.verify.mockResolvedValue({ personId: "person-1" })

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(request.principal).toEqual({ id: "person-1", roles: ["member"] })
    })

    it("refuses a door when the principal lacks one required role", async () => {
        const { guard, context, verifier, request } = await build("Bearer session-token", {
            roles: ["member", "admin"],
        })
        verifier.verify.mockResolvedValue({ personId: "person-1" })

        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Forbidden })

        expect(request.principal).toBeUndefined()
    })
}

const registerCredentialAuthorizationTests = (): void => {
    it("admits a credential door with a principal of the required kind without checking a session", async () => {
        const { guard, context, reflector, verifier, request } = await build("Bearer session-token", {
            credential: { kind: "api-key" },
        })
        request.credentialPrincipal = { kind: "api-key", subject: "key-1", workspaceId: "ws-1" }

        await expect(guard.canActivate(context)).resolves.toBe(true)

        expect(reflector.getAllAndOverride).toHaveBeenCalledWith(CREDENTIAL_KEY, [handler, Door])
        expect(verifier.verify).not.toHaveBeenCalled()
        expect(request.principal).toBeUndefined()
    })

    it("refuses a credential door without a credential principal even when a session could authenticate", async () => {
        const { guard, context, verifier, request } = await build("Bearer session-token", {
            credential: { kind: "api-key" },
        })
        request.principal = { id: "person-1", roles: ["member"] }
        verifier.verify.mockResolvedValue({ personId: "person-1" })

        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Unauthenticated })

        expect(verifier.verify).not.toHaveBeenCalled()
    })

    it("refuses a credential door with a principal of another kind", async () => {
        const { guard, context, verifier, request } = await build("Bearer session-token", {
            credential: { kind: "api-key" },
        })
        request.credentialPrincipal = { kind: "tool-token", subject: "tool-1", workspaceId: "ws-1" }
        verifier.verify.mockResolvedValue({ personId: "person-1" })

        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Unauthenticated })

        expect(verifier.verify).not.toHaveBeenCalled()
    })

    it("does not use public metadata to bypass a required credential principal", async () => {
        const { guard, context, verifier } = await build(undefined, {
            credential: { kind: "api-key" },
            public: { reason: PublicReason.Health },
        })

        await expect(guard.canActivate(context)).rejects.toMatchObject({ code: IdentityErrorCode.Unauthenticated })

        expect(verifier.verify).not.toHaveBeenCalled()
    })
}

describe("AuthGuard", () => {
    registerPublicDoorTests()
    registerSessionAuthenticationTests()
    registerRoleAuthorizationTests()
    registerCredentialAuthorizationTests()
})
