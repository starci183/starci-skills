import { Test } from "@nestjs/testing"
import { SepayTransferMapper } from "./sepay-transfer.mapper"

class TransferNotice extends SepayTransferMapper {
    readonly id = 92704
}

describe("SepayTransferMapper", () => {
    it("uses the notifier id as the inbox key without adding it to the wire body", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [TransferNotice] }).compile()
        const transfer = moduleRef.get(TransferNotice)
        expect(transfer.eventId).toBe("92704")
        expect(JSON.stringify(transfer)).toBe('{"id":92704}')
    })
})
