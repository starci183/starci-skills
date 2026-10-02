import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectOrderEntityManager } from "@modules/platform/database"
import type {
    CapturePaymentParams,
    FindPaymentParams,
    FindPaymentResult,
    PaymentView,
    RefundPaymentParams,
} from "./payment.contracts"
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
    constructor(
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Records a captured payment for an order in the caller transaction, stamped by the clock. */
    async capture(params: CapturePaymentParams): Promise<PaymentView> {
        const saved = await params.manager.save(
            PaymentEntity,
            params.manager.create(PaymentEntity, {
                personId: params.personId,
                orderId: params.orderId,
                amountMinorUnits: params.amountMinorUnits,
                status: "captured",
                createdAt: this.clock.now(),
            }),
        )
        return toPaymentView(saved)
    }

    /** Marks the captured payment of an order as given back in the caller transaction: the compensation of a capture; false when no captured payment remained. */
    async refund(params: RefundPaymentParams): Promise<boolean> {
        const result = await params.manager.update(
            PaymentEntity,
            { orderId: params.orderId, status: "captured" },
            { status: "refunded" },
        )
        return (result.affected ?? 0) > 0
    }

    /** The payment of an order, or null when none was captured. */
    async findByOrder(params: FindPaymentParams): Promise<FindPaymentResult> {
        const row = await (params.manager ?? this.entityManager).findOneBy(PaymentEntity, { orderId: params.orderId })
        return row ? toPaymentView(row) : null
    }
}
