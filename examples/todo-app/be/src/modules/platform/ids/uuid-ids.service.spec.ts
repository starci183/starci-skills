import { Test } from "@nestjs/testing"
import { UuidIds } from "./uuid-ids.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [UuidIds] }).compile()
    return moduleRef.get(UuidIds)
}

describe("UuidIds", () => {
    describe("next", () => {
        it("returns a version 4 UUID", async () => {
            const ids = await build()

            expect(ids.next()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        })

        it("returns a different id each time", async () => {
            const ids = await build()

            expect(ids.next()).not.toBe(ids.next())
        })
    })
})
