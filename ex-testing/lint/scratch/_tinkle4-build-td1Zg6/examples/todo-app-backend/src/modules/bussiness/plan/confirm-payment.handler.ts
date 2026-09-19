import {
    Injectable 
} from "@nestjs/common"
import {
    CommandHandler 
} from "@nestjs/cqrs"
import {
    AbstractCommandHandler 
} from "@modules/platform/cqrs/abstract-handler"
import {
    PlanPaymentIntentNotFoundException 
} from "@modules/shared/exceptions/errors/plan/plan-payment-intent-not-found"

import {
    SubscriptionService 
} from "./subscription.service"
import {
    PaymentService 
} from "./payment.service"
import {
    ConfirmPaymentCommand, ConfirmPaymentCommandResult 
} from "./confirm-payment.command"

const DEFAULT_PERIOD_MS = 30 * 24 * 60 * 60 * 1000

/**
 * The webhook half of fr.plan.upgrade and fr.plan.reconcile's mainFlow, and sds.plan.reconciliation's
 * sequence: applies the gateway's outcome for one payment intent through the same idempotent ledger
 * (br.plan.payment.idempotent / PaymentService.markPaidIfNotApplied) whether this call comes from a real
 * webhook delivery or a reconciliation poll standing in for one - "regardless of which path applies the
 * event first" per br.plan.payment.idempotent's own statement. A replay (alreadyApplied) or a failed
 * outcome arriving after a paid one already landed changes nothing and reports `applied: false`.
 */
@Injectable()
@CommandHandler(ConfirmPaymentCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class ConfirmPaymentHandler extends AbstractCommandHandler<ConfirmPaymentCommand, ConfirmPaymentCommandResult> {
    constructor(
    private readonly paymentService: PaymentService,
    private readonly subscriptionService: SubscriptionService,
    ) {
        super()
    }

    protected override async process(command: ConfirmPaymentCommand): Promise<ConfirmPaymentCommandResult> {
        const { gatewayIntentId, outcome, periodEnd } = command.params
        const intent = await this.paymentService.findByGatewayIntentId(gatewayIntentId)
        if (!intent) {
            throw new PlanPaymentIntentNotFoundException({
                intentId: gatewayIntentId 
            })
        }

        if (outcome === "failed") {
            return this.applyFailed(intent.id,
                intent.subscriptionId)
        }
        return this.applyPaid(intent.id,
            intent.subscriptionId,
            periodEnd ?? new Date(Date.now() + DEFAULT_PERIOD_MS))
    }

    /** t-gateway-abandoned: only fires when the intent had never been applied paid; a failed outcome
   * arriving after a paid one already landed (a race the idempotent ledger already resolved) never
   * unwinds that activation. */
    private async applyFailed(intentId: string, subscriptionId: string): Promise<ConfirmPaymentCommandResult> {
        const failed = await this.paymentService.markFailed(intentId)
        if (failed.appliedAt) {
            const subscription = await this.subscriptionService.findById(subscriptionId)
            return {
                applied: false, subscriptionStatus: subscription.status 
            }
        }
        const subscription = await this.subscriptionService.tGatewayAbandoned(subscriptionId)
        return {
            applied: false, subscriptionStatus: subscription.status 
        }
    }

    /** t-gateway-confirmed (from pending) or t-renewal-confirmed (from past-due), whichever the
   * subscription's current row is in; a replay of an already-applied intent takes neither transition. */
    private async applyPaid(intentId: string, subscriptionId: string, periodEnd: Date): Promise<ConfirmPaymentCommandResult> {
        const { alreadyApplied } = await this.paymentService.markPaidIfNotApplied(intentId)
        if (alreadyApplied) {
            const subscription = await this.subscriptionService.findById(subscriptionId)
            return {
                applied: false, subscriptionStatus: subscription.status 
            }
        }
        const before = await this.subscriptionService.findById(subscriptionId)
        const confirmed = before.status === "past-due"
            ? await this.subscriptionService.tRenewalConfirmed(subscriptionId,
                periodEnd)
            : await this.subscriptionService.tGatewayConfirmed(subscriptionId,
                periodEnd)
        return {
            applied: true, subscriptionStatus: confirmed.status 
        }
    }
}
