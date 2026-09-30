import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AddCartItemRequest, AddCartItemResult } from "./add-cart-item.contracts"

/** Asks to add units of a product to the caller cart. */
export class AddCartItemCommand extends Command<AddCartItemResult> {
    constructor(readonly params: ExecuteParams<AddCartItemRequest>) {
        super()
    }
}
