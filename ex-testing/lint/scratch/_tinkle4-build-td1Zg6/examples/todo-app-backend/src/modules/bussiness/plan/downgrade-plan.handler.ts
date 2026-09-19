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
    SubscriptionService 
} from "./subscription.service"
import {
    DowngradePlanCommand, DowngradePlanCommandResult 
} from "./downgrade-plan.command"

/**
 * fr.plan.downgrade: decision.plan.downgrade.policy chose accept-and-freeze, so this handler is exactly
 * SubscriptionService.tDowngrade with nothing else in front of it - never refused for being over the new
 * cap, and it touches no task row. br.plan.downgrade.freeze itself is not enforced here: it is enforced
 * by PlanCapGuardPolicy the next time the owner tries to create, from whatever count they are actually
 * at.
 */
@Injectable()
@CommandHandler(DowngradePlanCommand)
/** Decorated CQRS command handler; the bus dispatches to it and process() does the work (the abstract base keeps execute() a template). */
export class DowngradePlanHandler extends AbstractCommandHandler<DowngradePlanCommand, DowngradePlanCommandResult> {
    constructor(
    private readonly subscriptionService: SubscriptionService,
    ) {
        super()
    }

    protected override async process(command: DowngradePlanCommand): Promise<DowngradePlanCommandResult> {
        const subscription = await this.subscriptionService.tDowngrade(command.params.ownerId)
        return {
            subscriptionId: subscription.id, plan: subscription.plan, status: subscription.status 
        }
    }
}
