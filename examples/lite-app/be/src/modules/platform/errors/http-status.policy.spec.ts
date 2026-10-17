import { Test } from "@nestjs/testing"
import { HTTP_STATUS_BY_KIND } from "./http-status.policy"

const SUBJECT: unique symbol = Symbol("errors.http-status")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => HTTP_STATUS_BY_KIND }],
    }).compile()
    return moduleRef.get<typeof HTTP_STATUS_BY_KIND>(SUBJECT)
}

describe("HTTP_STATUS_BY_KIND", () => {
    it.each([
        ["invalid", 400],
        ["unauthenticated", 401],
        ["forbidden", 403],
        ["not-found", 404],
        ["conflict", 409],
        ["rate-limited", 429],
        ["unavailable", 503],
        ["internal", 500],
    ] as const)("answers a %s failure with HTTP %i", async (kind, status) => {
        const subject = await buildSubject()
        expect(subject[kind]).toBe(status)
    })

    it("maps every error kind and nothing else", async () => {
        const subject = await buildSubject()
        expect(Object.keys(subject)).toHaveLength(8)
    })
})
