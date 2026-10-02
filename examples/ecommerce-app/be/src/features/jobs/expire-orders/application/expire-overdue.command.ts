import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ExpireOverdueRequest, ExpireOverdueResult } from "./expire-overdue.contracts"

/** Asks to expire the orders nobody paid in time; the step of the expire-orders job sends it on every tick. */
export class ExpireOverdueCommand extends Command<ExpireOverdueResult> {
    constructor(readonly params: PublicExecuteParams<ExpireOverdueRequest>) {
        super()
    }
}
