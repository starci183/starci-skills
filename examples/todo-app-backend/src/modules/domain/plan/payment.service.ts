import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { PlanErrorCode } from "./errors/plan.error"
import { PaymentIntentEntity } from "./persistence/entities/payment-intent.entity"
import { toPaymentIntentView } from "./persistence/payment-intent.rows"
import type {
    AppliedIntent,
    CreatePaymentIntentParams,
    FindPaymentIntentByGatewayParams,
    FindPaymentIntentParams,
    PaymentIntentView,
    SettleIntentParams,
} from "./plan.contracts"

@Injectable()
/**
 * The idempotent ledger of the gateway: `id` is this product id and idempotency key, `gatewayIntentId` is the id the
 * gateway knows the transaction under. markPaidIfNotApplied is the one write that sets appliedAt, at most once per id,
 * under a row lock, so a webhook and a reconciliation poll converge: whichever comes first wins and the other is a no-op.
 */
export class PaymentService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Records a new pending intent for the subscription. */
    async create(params: CreatePaymentIntentParams): Promise<PaymentIntentView> {
        const saved = await params.manager.save(PaymentIntentEntity, {
            id: randomUUID(),
            subscriptionId: params.subscriptionId,
            gateway: "sepay",
            gatewayIntentId: params.gatewayIntentId,
            amount: params.amount,
            currency: params.currency,
            status: "pending",
            appliedAt: null,
        })
        return toPaymentIntentView(saved)
    }

    /** The intent with this id, or null. */
    async findById(params: FindPaymentIntentParams): Promise<PaymentIntentView | null> {
        const row = await (params.manager ?? this.entityManager).findOneBy(PaymentIntentEntity, { id: params.id })
        return row ? toPaymentIntentView(row) : null
    }

    /** The intent the gateway names by its own id, or null. */
    async findByGatewayIntentId(params: FindPaymentIntentByGatewayParams): Promise<PaymentIntentView | null> {
        const row = await (params.manager ?? this.entityManager).findOneBy(PaymentIntentEntity, {
            gatewayIntentId: params.gatewayIntentId,
        })
        return row ? toPaymentIntentView(row) : null
    }

    /** The first call for an intent applies it; every later call changes nothing and says so. */
    async markPaidIfNotApplied(
        params: SettleIntentParams,
    ): Promise<Outcome<AppliedIntent, PlanErrorCode.PaymentIntentNotFound>> {
        const row = await this.lock(params)
        if (!row) return refused(PlanErrorCode.PaymentIntentNotFound)
        if (row.appliedAt) return ok({ intent: toPaymentIntentView(row), alreadyApplied: true })
        const saved = await params.manager.save(PaymentIntentEntity, { ...row, status: "paid", appliedAt: params.at })
        return ok({ intent: toPaymentIntentView(saved), alreadyApplied: false })
    }

    /** The gateway shows the intent failed or expired; an intent already applied is never overturned. */
    async markFailed(params: SettleIntentParams): Promise<Outcome<PaymentIntentView, PlanErrorCode.PaymentIntentNotFound>> {
        const row = await this.lock(params)
        if (!row) return refused(PlanErrorCode.PaymentIntentNotFound)
        if (row.appliedAt) return ok(toPaymentIntentView(row))
        const saved = await params.manager.save(PaymentIntentEntity, { ...row, status: "failed" })
        return ok(toPaymentIntentView(saved))
    }

    private lock(params: SettleIntentParams): Promise<PaymentIntentEntity | null> {
        return params.manager.findOne(PaymentIntentEntity, {
            where: { id: params.id },
            lock: { mode: "pessimistic_write" },
        })
    }
}
