import { Test } from "@nestjs/testing"
import { SystemIds } from "./system-ids.service"

describe("SystemIds", () => {
    it("answers a UUID, and a different one each time", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [SystemIds] }).compile()
        const ids = moduleRef.get(SystemIds)

        const first = ids.next()
        const second = ids.next()

        expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        expect(second).not.toBe(first)
    })
})
