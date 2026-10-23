import { Test } from "@nestjs/testing"
import type { Principal } from "@modules/platform/cqrs"
import { admit } from "./admission.policy"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

const principal: Principal = { id: "user-1", role: "authenticated" }

const ADMISSION: unique symbol = Symbol("identity.admission")

/** A record is read as metadata whatever its fields: the admission under test is what judges the reason. */
const isMetadata = (value: unknown): value is PublicMetadata => typeof value === "object" && value !== null

const runtimeMetadata = (source: string): PublicMetadata => {
    try {
        const parsed: unknown = JSON.parse(source)
        if (!isMetadata(parsed)) throw new IdentityError({ code: IdentityErrorCode.Unauthenticated })
        return parsed
    } catch (cause) {
        throw new IdentityError({ code: IdentityErrorCode.Unauthenticated, cause })
    }
}

describe("admit", () => {
    let subject: typeof admit

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: ADMISSION, useFactory: () => admit }],
        }).compile()
        subject = moduleRef.get<typeof admit>(ADMISSION)
    })

    it("admits a door that states why it is public, with or without a caller", () => {
        expect(subject({ reason: PublicReason.Health }, undefined)).toSucceedWith(PublicReason.Health)
        expect(subject({ reason: PublicReason.SignedWebhook }, principal)).toSucceedWith(PublicReason.SignedWebhook)
        expect(subject({ reason: PublicReason.AuthHandshake }, undefined)).toSucceedWith(PublicReason.AuthHandshake)
        expect(subject({ reason: PublicReason.CatalogRead }, undefined)).toSucceedWith(PublicReason.CatalogRead)
    })

    it("does not trust a reason outside the closed vocabulary", () => {
        const outside = runtimeMetadata('{"reason":"anything"}')
        expect(subject(outside, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
        expect(subject(outside, principal)).toSucceedWith(principal)
    })

    it("does not treat runtime metadata without a public reason as public", () => {
        const metadata = runtimeMetadata("{}")
        expect(subject(metadata, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
        expect(subject(metadata, principal)).toSucceedWith(principal)
    })

    it("admits the verified principal of a door that is not public", () => {
        expect(subject(undefined, principal)).toSucceedWith(principal)
    })

    it("admits a credential door whose principal has the required kind", () => {
        const credentialPrincipal = { kind: "api-key", subject: "key-1", workspaceId: "ws-1" } as const
        const credential = { required: { kind: "api-key" }, principal: credentialPrincipal } as const

        expect(subject(undefined, undefined, credential)).toSucceedWith(credentialPrincipal)
        expect(subject(undefined, principal, credential)).toSucceedWith(credentialPrincipal)
        expect(subject({ reason: PublicReason.Health }, principal, credential)).toSucceedWith(credentialPrincipal)
    })

    it("refuses a credential door without a credential principal, even with a session or public metadata", () => {
        const credential = { required: { kind: "api-key" }, principal: undefined } as const

        expect(subject(undefined, undefined, credential)).toBeRefused(IdentityErrorCode.Unauthenticated)
        expect(subject(undefined, principal, credential)).toBeRefused(IdentityErrorCode.Unauthenticated)
        expect(subject({ reason: PublicReason.Health }, principal, credential)).toBeRefused(
            IdentityErrorCode.Unauthenticated,
        )
    })

    it("refuses a credential principal of another kind, even with a session or public metadata", () => {
        const credentialPrincipal = { kind: "tool-token", subject: "tool-1", workspaceId: "ws-1" } as const
        const credential = { required: { kind: "api-key" }, principal: credentialPrincipal } as const

        expect(subject(undefined, undefined, credential)).toBeRefused(IdentityErrorCode.Unauthenticated)
        expect(subject(undefined, principal, credential)).toBeRefused(IdentityErrorCode.Unauthenticated)
        expect(subject({ reason: PublicReason.Health }, principal, credential)).toBeRefused(
            IdentityErrorCode.Unauthenticated,
        )
    })

    it("refuses a door that is not public when no principal was verified", () => {
        expect(subject(undefined, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })
})
