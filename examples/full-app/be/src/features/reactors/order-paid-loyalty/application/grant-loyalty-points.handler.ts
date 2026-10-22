import { CommandHandler } from "@nestjs/cqrs"
import { LoyaltyService } from "@modules/domain/loyalty"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GrantLoyaltyPointsCommand } from "./grant-loyalty-points.command"

@CommandHandler(GrantLoyaltyPointsCommand)
/** Grants the loyalty points of one paid order; the order paid consumer sends it for every delivered event. */
export class GrantLoyaltyPointsHandler extends ICQRSHandler<GrantLoyaltyPointsCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly loyalty: LoyaltyService,
    ) {
        super(logger)
    }

    protected override process(command: GrantLoyaltyPointsCommand): Promise<void> {
        return this.loyalty.grantForOrder(command.params.request)
    }
}
