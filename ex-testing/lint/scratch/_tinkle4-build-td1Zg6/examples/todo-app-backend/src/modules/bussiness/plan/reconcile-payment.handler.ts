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
    SepayClient 
} from "@modules/integrations/sepay/sepay.client"
import {
    PlanForbiddenException 
} from "@modules/shared/exceptions/errors/plan/plan-forbidden"

import {
    SubscriptionService 
} from "./subscription.service"
import {
    PaymentService 
} from "./payment.service"
import {
    ConfirmPaymentHandler 
} from "./confirm-payment.handler"
import {
    ConfirmPaymentCommand 
} from "./confirm-payment.command"
import {
    ReconcilePaymentCommand, ReconcilePaymentCommandResult 
} from "./reconcile-payment.command"

/**
 * fr.plan.reconcile / sds.plan.reconciliation: polls the gateway directly for a payment intent's status
 * and applies exactly the transition a webhook would have applied, through the same idempotent ledger -
 * this handler calls `ConfirmPaymentHandler.execute` directly (not the CommandBus a second time) so a
 * reconcile and a late webhook racing each other converge on the exact same idempotency check
 * (`PaymentService.markPaidIfNotApplied`) rather than each carrying its own, per that record's own
 * sequence note. An intent already applied or already failed is answered without a gateway call, since
 * nothing more could change; only a genuinely pending intent is ever polled.
 */
@Injectable()
@CommandHandler(ReconcilePaymentCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class ReconcilePaymentHandler extends AbstractCommandHandler<ReconcilePaymentCommand, ReconcilePaymentCommandResult> {
    constructor(
    private readonly paymentService: PaymentService,
    private readonly subscriptionService: SubscriptionService,
    private readonly sepayClient: SepayClient,
    private readonly confirmPaymentHandler: ConfirmPaymentHandler,
    ) {
        super()
    }

    protected override async process(command: ReconcilePaymentCommand): Promise<ReconcilePaymentCommandResult> {
        const { actorId, paymentIntentId } = command.params
        const intent = await this.paymentService.findById(paymentIntentId)
        const subscription = await this.subscriptionService.findById(intent.subscriptionId)
        if (subscription.personId !== actorId) {
            throw new PlanForbiddenException({
                subscriptionId: subscription.id, actorId 
            })
        }

        if (intent.appliedAt || intent.status === "failed") {
            // Already resolved by an earlier webhook or reconcile; nothing left to poll for.
            return {
                gatewayStatus: intent.status, applied: false, subscriptionStatus: subscription.status 
            }
        }

        const gatewayResult = await this.sepayClient.getTransaction(intent.gatewayIntentId)
        if (gatewayResult.status === "pending") {
            // exceptionFlow: "The gateway still shows the intent pending; nothing changes and it is checked
            // again later."
            return {
                gatewayStatus: "pending", applied: false, subscriptionStatus: subscription.status 
            }
        }

        const confirmed = await this.confirmPaymentHandler.execute(
            new ConfirmPaymentCommand({
                gatewayIntentId: intent.gatewayIntentId,
                outcome: gatewayResult.status,
                periodEnd: gatewayResult.periodEnd,
            }),
        )
        return {
            gatewayStatus: gatewayResult.status, applied: confirmed.applied, subscriptionStatus: confirmed.subscriptionStatus 
        }
    }
}
