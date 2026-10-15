import { Test } from "@nestjs/testing"
import type { Principal } from "@modules/platform/cqrs"
import { admit } from "./admission.policy"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

const principal: Principal = { id: "user-1", role: "authenticated" }

const ADMISSION: unique symbol = Symbol("identity.admission")

const runtimeMetadata = (source: string): PublicMetadata => {
    try {
        const metadata: PublicMetadata = JSON.parse(source)
        return metadata
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

    it("refuses a door that is not public when no principal was verified", () => {
        expect(subject(undefined, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })
})
