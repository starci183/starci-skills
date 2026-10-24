import { Test } from "@nestjs/testing"
import { SepayErrorCode } from "./errors/sepay.error"
import { SEPAY_PAGE_MAX } from "./sepay-transactions.schema"
import { SepayTransactionsMapper } from "./sepay-transactions.mapper"

const transaction = (id: string) => ({
    id,
    transaction_date: "2026-10-24 09:30:00",
    amount_in: "150000.00",
    transaction_content: "INV 0042",
    reference_number: null,
})

const build = async (): Promise<SepayTransactionsMapper> => {
    const moduleRef = await Test.createTestingModule({ providers: [SepayTransactionsMapper] }).compile()
    return moduleRef.get(SepayTransactionsMapper)
}

describe("SepayTransactionsMapper", () => {
    it("returns the transactions of a well formed answer", async () => {
        const body = { status: 200, transactions: [transaction("92704"), transaction("92705")] }
        expect((await build()).read(body).map((entry) => entry.id)).toEqual(["92704", "92705"])
    })

    it("refuses an answer whose transactions are missing a field", async () => {
        const body = { status: 200, transactions: [{ id: "92704" }] }
        const mapper = await build()
        expect(() => mapper.read(body)).toThrow(SepayErrorCode.MalformedResponse)
    })

    it("refuses an answer that is not an object", async () => {
        const mapper = await build()
        expect(() => mapper.read("<html>")).toThrow(SepayErrorCode.MalformedResponse)
    })

    it("refuses a page longer than the bound without reading its elements", async () => {
        const body = {
            status: 200,
            transactions: Array.from({ length: SEPAY_PAGE_MAX + 1 }, (_, index) => transaction(String(index))),
        }
        const mapper = await build()
        expect(() => mapper.read(body)).toThrow(SepayErrorCode.MalformedResponse)
    })

    it("refuses a string longer than its bound", async () => {
        const body = { status: 200, transactions: [{ ...transaction("1"), transaction_content: "x".repeat(501) }] }
        const mapper = await build()
        expect(() => mapper.read(body)).toThrow(SepayErrorCode.MalformedResponse)
    })
})
