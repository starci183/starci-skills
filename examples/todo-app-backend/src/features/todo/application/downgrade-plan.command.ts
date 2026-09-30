import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DowngradePlanRequest, DowngradePlanResult } from "./downgrade-plan.contracts"

/** Asks to return the plan of the caller to free. */
export class DowngradePlanCommand extends Command<DowngradePlanResult> {
    constructor(readonly params: ExecuteParams<DowngradePlanRequest>) {
        super()
    }
}
