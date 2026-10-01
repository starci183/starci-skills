import { CommandHandler } from "@nestjs/cqrs"
import { PlanCheckoutService } from "@modules/domain/plan"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DowngradePlanCommand } from "./downgrade-plan.command"
import type { DowngradePlanResult } from "./downgrade-plan.contracts"

@CommandHandler(DowngradePlanCommand)
/** Returns the caller to the free plan at once. */
export class DowngradePlanHandler extends ICQRSHandler<DowngradePlanCommand, DowngradePlanResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly checkout: PlanCheckoutService,
    ) {
        super(logger)
    }

    protected override async process(command: DowngradePlanCommand): Promise<DowngradePlanResult> {
        return this.checkout.downgrade({ personId: command.params.principal.id })
    }
}
