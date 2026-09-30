import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { HandoffStatus } from "@/modules/types"
import { HandoffBlockBase, type HandoffBlockData } from "./component"

const slotLabels = { empty: "empty", forbidden: "forbidden", error: "error", retry: "retry" }
const ready: HandoffBlockData = {
    order: { items: { code: "SO-2026-091", customer: "Northstar Retail", amount: 480000000, lines: [{ sku: "A", qty: 2 }] } },
    handoff: { items: { status: "prepared", fingerprint: "fp-ho-91", revision: 2, receiptId: "RC-1", reason: "Missing VAT" } },
    labels: {
        title: "title", prepared: "prepared", sent: "sent", returned: "returned", send: "send", resend: "resend",
        fingerprint: "fingerprint", revision: "revision", receipt: "receipt", reason: "reason",
        customer: "customer", amount: "amount", lines: "lines",
        orderSlot: slotLabels, handoffSlot: slotLabels,
    },
}
const on = { requestSend: vi.fn(), retryOrder: vi.fn(), retryHandoff: vi.fn() }

// Audit contract: every shape, then one slot at a time in every status (4 × slots + 1 cases).
// The Base is pure, so no api is mocked.
const shapes: ReadonlyArray<HandoffStatus> = ["prepared", "sent", "returned"]
const statuses = [{ isLoading: true }, { isForbidden: true }, { isError: true }, { items: undefined }]

describe("HandoffBlockBase", () => {
    it.each(shapes)("%s renders ready", (state) => {
        render(<HandoffBlockBase state={state} props={ready} on={on} />)
        expect(screen.getAllByText(/Northstar Retail|Missing VAT/).length).toBeGreaterThan(0)
    })

    for (const state of shapes) {
        for (const slot of ["order", "handoff"] as const) {
            it.each(statuses)(`${state}/${slot} %o changes only that slot`, (status) => {
                render(<HandoffBlockBase state={state} props={{ ...ready, [slot]: status }} on={on} />)
                const untouched = slot === "order" ? /fp-ho-91|RC-1|Missing VAT/ : /Northstar Retail/
                expect(screen.getAllByText(untouched).length).toBeGreaterThan(0)
            })
        }
    }
})
