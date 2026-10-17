import { Test } from "@nestjs/testing"
import type { Principal } from "@modules/platform/cqrs"
import { admit } from "./admission.policy"
import type { CredentialPrincipal } from "./credential.contracts"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

const principal: Principal = { id: "person-1", email: "person-1@example.test", role: "authenticated" }
const credentialPrincipal: CredentialPrincipal = { kind: "api-key", subject: "key-1", workspaceId: "ws-1" }

const SUBJECT = Symbol("admission policy")
const parseMetadata = (text: string): PublicMetadata => {
    try {
        const metadata: PublicMetadata = JSON.parse(text)
        return metadata
    } catch (cause) {
        throw new IdentityError({ code: IdentityErrorCode.Unauthenticated, cause })
    }
}

describe("admit", () => {
    let subject: typeof admit

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useFactory: () => admit }],
        }).compile()
        subject = moduleRef.get<typeof admit>(SUBJECT)
    })

    it("admits a public door with its reason, whoever calls", () => {
        expect(subject({ reason: PublicReason.Health }, undefined)).toSucceedWith(PublicReason.Health)
        expect(subject({ reason: PublicReason.SignedWebhook }, principal)).toSucceedWith(PublicReason.SignedWebhook)
    })

    it("admits a verified principal on a door that is not public", () => {
        expect(subject(undefined, principal)).toSucceedWith(principal)
    })

    it("admits a credential door whose principal has the required kind", () => {
        expect(
            subject(undefined, undefined, { required: { kind: "api-key" }, principal: credentialPrincipal }),
        ).toSucceedWith(credentialPrincipal)
    })

    it("refuses a credential door without a principal of the required kind", () => {
        const required = { kind: "tool-token" } as const

        expect(subject(undefined, undefined, { required, principal: credentialPrincipal })).toBeRefused(
            IdentityErrorCode.Unauthenticated,
        )
        expect(subject(undefined, undefined, { required, principal: undefined })).toBeRefused(
            IdentityErrorCode.Unauthenticated,
        )
    })

    it("requires a matching credential even when the door is public or the session is verified", () => {
        const credential = { required: { kind: "api-key" }, principal: undefined } as const

        expect(subject({ reason: PublicReason.Health }, principal, credential)).toBeRefused(
            IdentityErrorCode.Unauthenticated,
        )
    })

    it("refuses a door that is not public when no principal was verified", () => {
        expect(subject(undefined, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it.each([PublicReason.AuthHandshake, PublicReason.CatalogRead])(
        "refuses the unsupported public reason %s even with a verified session",
        (reason) => {
            expect(subject({ reason }, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
            expect(subject({ reason }, principal)).toBeRefused(IdentityErrorCode.Unauthenticated)
        },
    )

    it("refuses an unknown public reason supplied as runtime metadata", () => {
        const metadata: PublicMetadata = parseMetadata('{"reason":"tool-token"}')

        expect(subject(metadata, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it("refuses runtime metadata without a public reason", () => {
        const metadata: PublicMetadata = parseMetadata("{}")

        expect(subject(metadata, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })
})
