import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import type { AccrueParams, CommissionView } from "./commission.contracts"
import { CommissionErrorCode } from "./errors/commission.error"
import { toCommissionView } from "./persistence/commission.rows"
import { CommissionEntity } from "./persistence/entities/commission.entity"

const BPS_DENOMINATOR = 10_000

@Injectable()
/**
 * The referral commissions: a paid plan purchase accrues floor(paid * bps / 10000) to the person who referred the
 * buyer, once per payment. A person is never their own referrer, and accruing the same payment again answers the first
 * accrual without writing.
 */
export class CommissionService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
    ) {}

    /** Accrues the commission of one paid payment, or refuses a self referral; a duplicate answers the existing accrual. */
    async accrue(params: AccrueParams): Promise<Outcome<CommissionView, CommissionErrorCode.SelfReferral>> {
        if (params.referrerId === params.buyerId) {
            return refused(CommissionErrorCode.SelfReferral, { personId: params.buyerId })
        }
        const existing = await this.entityManager.findOneBy(CommissionEntity, { paymentId: params.paymentId })
        if (existing) return ok(toCommissionView(existing))
        const saved = await this.entityManager.save(CommissionEntity, {
            id: this.ids.next(),
            referrerId: params.referrerId,
            buyerId: params.buyerId,
            paymentId: params.paymentId,
            amount: Math.floor((params.paidMinorUnits * params.bps) / BPS_DENOMINATOR),
            accruedAt: this.clock.now(),
        })
        return ok(toCommissionView(saved))
    }
}
