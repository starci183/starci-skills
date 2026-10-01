import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpgradePlanRequest, UpgradePlanResult } from "./upgrade-plan.contracts"

/** Asks to open the checkout of the paid plan for the caller. */
export class UpgradePlanCommand extends Command<UpgradePlanResult> {
    constructor(readonly params: ExecuteParams<UpgradePlanRequest>) {
        super()
    }
}
