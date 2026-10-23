import type { ExecutionContext } from "@nestjs/common"
import type { HttpArgumentsHost } from "@nestjs/common/interfaces"
import { Reflector } from "@nestjs/core"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AuthGuard } from "./auth.guard"
import type { CredentialMetadata, CredentialPrincipal } from "./credential.contracts"
import { IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"
import { CREDENTIAL_KEY, PUBLIC_KEY } from "./identity.decorators"

interface Door {
    readonly credential?: CredentialMetadata
    readonly metadata?: PublicMetadata
    readonly principal?: CredentialPrincipal
}

const build = async ({ credential, metadata }: Door) => {
    const reflector = mock<Reflector>()
    reflector.getAllAndOverride.mockImplementation((key: unknown) =>
        key === CREDENTIAL_KEY ? credential : key === PUBLIC_KEY ? metadata : undefined,
    )
    const moduleRef = await Test.createTestingModule({
        providers: [AuthGuard, { provide: Reflector, useValue: reflector }],
    }).compile()
    return moduleRef.get(AuthGuard)
}

const contextOf = (principal?: CredentialPrincipal) => {
    const context = mock<ExecutionContext>()
    context.getHandler.mockReturnValue(() => undefined)
    context.getClass.mockReturnValue(class DoorClass {})
    context.getType.mockReturnValue("http")
    const host = mock<HttpArgumentsHost>()
    host.getRequest.mockReturnValue({ credentialPrincipal: principal })
    context.switchToHttp.mockReturnValue(host)
    return context
}

const API_KEY: CredentialPrincipal = { kind: "api-key", subject: "key-1", workspaceId: "ws-1" }

describe("AuthGuard", () => {
    it("lets a door through when it states why it is public", async () => {
        const guard = await build({ metadata: { reason: PublicReason.Health } })

        expect(guard.canActivate(contextOf())).toBe(true)
    })

    it("refuses every door that is neither public nor credential-marked", async () => {
        const guard = await build({})

        expect(() => guard.canActivate(contextOf())).toThrow(IdentityErrorCode.Unauthenticated)
    })

    it("lets a credential door through once the credential principal is set", async () => {
        const guard = await build({ credential: { kind: "api-key" } })

        expect(guard.canActivate(contextOf(API_KEY))).toBe(true)
    })

    it("refuses a credential door without a credential principal", async () => {
        const guard = await build({ credential: { kind: "api-key" } })

        expect(() => guard.canActivate(contextOf())).toThrow(IdentityErrorCode.Unauthenticated)
    })
})
