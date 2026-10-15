import { Test } from "@nestjs/testing"
import { admit } from "./admission.policy"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

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

    it.each([PublicReason.Health, PublicReason.AuthHandshake, PublicReason.SignedWebhook, PublicReason.CatalogRead])(
        "admits a door with the canonical public reason %s",
        (reason) => {
            expect(subject({ reason })).toSucceedWith(reason)
        },
    )

    it("refuses a door that is not public", () => {
        expect(subject(undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it("refuses an unknown public reason supplied as runtime metadata", () => {
        const metadata = runtimeMetadata('{"reason":"tool-token"}')
        expect(subject(metadata)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it("refuses runtime metadata without a public reason", () => {
        const metadata = runtimeMetadata("{}")
        expect(subject(metadata)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })
})
