import { builder } from "@starci/jest-preset"
import type { AccrueParams, CommissionRow } from "@modules/domain/commission"

/** The instant the commission specs stamp accruals with. */
export const COMMISSION_AT = "2026-09-10T10:00:00.000Z"

/** A stored commission row with valid defaults; override only what the spec is about. */
export const commissionRow = builder<CommissionRow>({
    id: "c-1",
    referrerId: "ref-1",
    buyerId: "buyer-1",
    paymentId: "pay-1",
    amount: 29_999,
    accruedAt: new Date(COMMISSION_AT),
})

/** The input of one accrual: 99 999 minor units paid at 30 percent. */
export const accrueInput = builder<AccrueParams>({
    referrerId: "ref-1",
    buyerId: "buyer-1",
    paymentId: "pay-1",
    paidMinorUnits: 99_999,
    bps: 3000,
})
