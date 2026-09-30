import { Injectable } from "@nestjs/common"
import { EntityManager } from "typeorm"
import { InjectOrderEntityManager } from "@modules/platform/database"
import type { CapturePaymentParams, FindPaymentParams, FindPaymentResult, PaymentView } from "./payment.contracts"
import { PaymentEntity } from "./persistence/entities/payment.entity"

const toPaymentView = (row: PaymentEntity): PaymentView => ({
    paymentId: row.id,
    amountMinorUnits: row.amountMinorUnits,
})

@Injectable()
/**
 * The internal payment ledger. This example has no external PSP and therefore no integration for one; this capability is
 * the seam a gateway plugs into. It writes inside the caller transaction and the unique order id means an order is
 * paid once.
 */
export class PaymentService {
    constructor(@InjectOrderEntityManager() private readonly entityManager: EntityManager) {}

    /** Records a captured payment for an order in the caller transaction. */
    async capture(params: CapturePaymentParams): Promise<PaymentView> {
        const saved = await params.manager.save(
            PaymentEntity,
            params.manager.create(PaymentEntity, {
                personId: params.personId,
                orderId: params.orderId,
                amountMinorUnits: params.amountMinorUnits,
                status: "captured",
            }),
        )
        return toPaymentView(saved)
    }

    /** The payment of an order, or null when none was captured. */
    async findByOrder(params: FindPaymentParams): Promise<FindPaymentResult> {
        const row = await (params.manager ?? this.entityManager).findOneBy(PaymentEntity, { orderId: params.orderId })
        return row ? toPaymentView(row) : null
    }
}
