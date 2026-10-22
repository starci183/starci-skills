import { Test } from "@nestjs/testing"
import { admit } from "./admission.policy"
import { IdentityError, IdentityErrorCode } from "./errors/identity.error"
import type { PublicMetadata } from "./identity.contracts"
import { PublicReason } from "./identity.contracts"

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

    it.each([PublicReason.Health])("admits a door with the canonical public reason %s", (reason) => {
        expect(subject({ reason })).toSucceedWith(reason)
    })

    it("admits a credential door whose principal has the required kind", () => {
        const principal = { kind: "api-key", subject: "key-1", workspaceId: "ws-1" } as const

        expect(subject(undefined, { required: { kind: "api-key" }, principal })).toSucceedWith(principal)
    })

    it("refuses a credential door without a principal of the required kind", () => {
        const principal = { kind: "tool-token", subject: "tool-1", workspaceId: "ws-1" } as const

        expect(subject(undefined, { required: { kind: "api-key" }, principal })).toBeRefused(
            IdentityErrorCode.Unauthenticated,
        )
        expect(subject(undefined, { required: { kind: "api-key" }, principal: undefined })).toBeRefused(
            IdentityErrorCode.Unauthenticated,
        )
    })

    it("refuses a door that is not public", () => {
        expect(subject(undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it.each([PublicReason.AuthHandshake, PublicReason.SignedWebhook, PublicReason.CatalogRead])(
        "refuses a door with the unsupported public reason %s",
        (reason) => {
            expect(subject({ reason })).toBeRefused(IdentityErrorCode.Unauthenticated)
        },
    )

    it("refuses an unknown public reason supplied as runtime metadata", () => {
        const metadata = runtimeMetadata('{"reason":"tool-token"}')
        expect(subject(metadata)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })

    it("refuses runtime metadata without a public reason", () => {
        const metadata = runtimeMetadata("{}")
        expect(subject(metadata)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })
})
