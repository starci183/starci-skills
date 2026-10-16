import type { ExecutionContext } from "@nestjs/common"
import type { HttpArgumentsHost } from "@nestjs/common/interfaces"
import { Reflector } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { CredentialGuard } from "./credential.guard"
import type { CredentialAuthenticator, CredentialMetadata, CredentialPrincipal } from "./credential.contracts"
import { IdentityErrorCode } from "./errors/identity.error"
import { CREDENTIAL_AUTHENTICATOR } from "./identity.decorators"

const PRINCIPAL: CredentialPrincipal = { kind: "tool-token", subject: "tool-1", workspaceId: "ws-1" }

interface FakeRequest {
    credentialPrincipal?: CredentialPrincipal
    readonly headers: { readonly authorization: string }
    readonly params: { readonly id: string }
}

const build = async (metadata: CredentialMetadata | undefined, principal: CredentialPrincipal = PRINCIPAL) => {
    const reflector = mock<Reflector>()
    reflector.getAllAndOverride.mockReturnValue(metadata)
    const authenticator = mock<CredentialAuthenticator>()
    authenticator.authenticate.mockResolvedValue(principal)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CredentialGuard,
            { provide: Reflector, useValue: reflector },
            { provide: CREDENTIAL_AUTHENTICATOR, useValue: authenticator },
        ],
    }).compile()
    return { guard: moduleRef.get(CredentialGuard), authenticator }
}

const contextOf = (request: FakeRequest) => {
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(() => undefined)
    context.getClass.mockReturnValue(class DoorClass {})
    context.getType.mockReturnValue("http")
    const host = mock<HttpArgumentsHost>()
    host.getRequest.mockReturnValue(request)
    context.switchToHttp.mockReturnValue(host)
    return context
}

const requestOf = (): FakeRequest => ({ headers: { authorization: "Bearer secret" }, params: { id: "run-1" } })

describe("CredentialGuard", () => {
    it("passes a door without credential metadata and authenticates nothing", async () => {
        const { guard, authenticator } = await build(undefined)

        await expect(guard.canActivate(contextOf(requestOf()))).resolves.toBe(true)
        expect(authenticator.authenticate).not.toHaveBeenCalled()
    })

    it("authenticates a credential door and sets the credential principal", async () => {
        const { guard, authenticator } = await build({ kind: "tool-token" }, PRINCIPAL)
        const request = requestOf()

        await expect(guard.canActivate(contextOf(request))).resolves.toBe(true)
        expect(request.credentialPrincipal).toEqual(PRINCIPAL)
        expect(authenticator.authenticate).toHaveBeenCalledWith({ kind: "tool-token" }, "Bearer secret", "run-1")
    })

    it("refuses a principal of another credential kind", async () => {
        const { guard } = await build({ kind: "api-key" }, PRINCIPAL)
        const request = requestOf()

        await expect(guard.canActivate(contextOf(request))).rejects.toMatchObject({ code: IdentityErrorCode.Unauthenticated })
        expect(request.credentialPrincipal).toBeUndefined()
    })
})
