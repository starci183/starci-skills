import { admit } from "./admission.policy"
import { IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

describe("admit", () => {
    it.each([PublicReason.Health, PublicReason.AuthHandshake, PublicReason.SignedWebhook, PublicReason.CatalogRead])(
        "admits a door with the canonical public reason %s",
        (reason) => {
            expect(admit({ reason })).toSucceedWith(reason)
        },
    )

    it("refuses a door that is not public", () => {
        expect(admit(undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it("refuses an unknown public reason supplied as runtime metadata", () => {
        const metadata = JSON.parse('{"reason":"tool-token"}') as PublicMetadata
        expect(admit(metadata)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it("refuses runtime metadata without a public reason", () => {
        const metadata = JSON.parse("{}") as PublicMetadata
        expect(admit(metadata)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })
})
