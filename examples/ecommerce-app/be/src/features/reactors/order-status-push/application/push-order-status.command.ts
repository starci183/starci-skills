import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { PushOrderStatusRequest, PushOrderStatusResult } from "./push-order-status.contracts"

/** Pushes one status change of an order to its buyer; the order paid and order expired consumers send it for every delivered event. */
export class PushOrderStatusCommand extends Command<PushOrderStatusResult> {
    constructor(readonly params: PublicExecuteParams<PushOrderStatusRequest>) {
        super()
    }
}
