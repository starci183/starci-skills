import { CommandHandler } from "@nestjs/cqrs"
import { PlanCheckoutService } from "@modules/domain/plan"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpgradePlanCommand } from "./upgrade-plan.command"
import type { UpgradePlanResult } from "./upgrade-plan.contracts"

@CommandHandler(UpgradePlanCommand)
/** Opens the checkout of the paid plan for the caller. */
export class UpgradePlanHandler extends ICQRSHandler<UpgradePlanCommand, UpgradePlanResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly checkout: PlanCheckoutService,
    ) {
        super(logger)
    }

    protected override async process(command: UpgradePlanCommand): Promise<UpgradePlanResult> {
        return this.checkout.upgrade({ personId: command.params.principal.id })
    }
}
