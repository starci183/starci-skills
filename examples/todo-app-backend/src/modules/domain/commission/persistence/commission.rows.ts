import type { CommissionView } from "../commission.contracts"
import type { CommissionEntity } from "./entities/commission.entity"

/** Maps a commission row to the view callers get. */
export const toCommissionView = (row: CommissionEntity): CommissionView => ({
    id: row.id,
    referrerId: row.referrerId,
    buyerId: row.buyerId,
    paymentId: row.paymentId,
    amount: row.amount,
    accruedAt: row.accruedAt,
})
