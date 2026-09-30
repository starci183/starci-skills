import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ClearCartRequest, ClearCartResult } from "./clear-cart.contracts"

/** Asks to empty the caller cart. */
export class ClearCartCommand extends Command<ClearCartResult> {
    constructor(readonly params: ExecuteParams<ClearCartRequest>) {
        super()
    }
}
