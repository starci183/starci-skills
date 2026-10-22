import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ExpireOverdueOrdersResult } from "@modules/domain/order"
import type { ExpireOverdueRequest } from "./expire-overdue.contracts"

/** Asks to expire the orders nobody paid in time; the step of the expire-orders job sends it on every tick. */
export class ExpireOverdueCommand extends Command<ExpireOverdueOrdersResult> {
    constructor(readonly params: PublicExecuteParams<ExpireOverdueRequest>) {
        super()
    }
}
