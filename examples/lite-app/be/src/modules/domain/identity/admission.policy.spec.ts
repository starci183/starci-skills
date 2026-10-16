import type { Principal } from "@modules/platform/cqrs"
import { admit } from "./admission.policy"
import type { CredentialPrincipal } from "./credential.contracts"
import { IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

const principal: Principal = { id: "person-1", email: "person-1@example.test", role: "authenticated" }
const credentialPrincipal: CredentialPrincipal = { kind: "api-key", subject: "key-1", workspaceId: "ws-1" }

describe("admit", () => {
    it("admits a public door with its reason, whoever calls", () => {
        expect(admit({ reason: PublicReason.Health }, undefined)).toSucceedWith(PublicReason.Health)
        expect(admit({ reason: PublicReason.SignedWebhook }, principal)).toSucceedWith(PublicReason.SignedWebhook)
    })

    it("admits a verified principal on a door that is not public", () => {
        expect(admit(undefined, principal)).toSucceedWith(principal)
    })

    it("admits a credential door whose principal has the required kind", () => {
        expect(admit(undefined, undefined, { required: { kind: "api-key" }, principal: credentialPrincipal })).toSucceedWith(
            credentialPrincipal,
        )
    })

    it("refuses a credential door without a principal of the required kind", () => {
        const required = { kind: "tool-token" } as const

        expect(admit(undefined, undefined, { required, principal: credentialPrincipal })).toBeRefused(IdentityErrorCode.Unauthenticated)
        expect(admit(undefined, undefined, { required, principal: undefined })).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it("requires a matching credential even when the door is public or the session is verified", () => {
        const credential = { required: { kind: "api-key" }, principal: undefined } as const

        expect(admit({ reason: PublicReason.Health }, principal, credential)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it("refuses a door that is not public when no principal was verified", () => {
        expect(admit(undefined, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it("refuses an unknown public reason supplied as runtime metadata", () => {
        const metadata: PublicMetadata = JSON.parse('{"reason":"tool-token"}')

        expect(admit(metadata, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it("refuses runtime metadata without a public reason", () => {
        const metadata: PublicMetadata = JSON.parse("{}")

        expect(admit(metadata, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })
})
