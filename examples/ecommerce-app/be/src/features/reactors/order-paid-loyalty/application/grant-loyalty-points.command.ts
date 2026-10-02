import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { GrantLoyaltyPointsRequest } from "./grant-loyalty-points.contracts"

/** Grants the loyalty points of one paid order; the order paid consumer sends it for every delivered event. */
export class GrantLoyaltyPointsCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<GrantLoyaltyPointsRequest>) {
        super()
    }
}
