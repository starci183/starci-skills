import { CommandHandler } from "@nestjs/cqrs"
import { EntityManager } from "typeorm"
import { CartService } from "@modules/domain/cart"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectOrderEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ClearCartResult } from "./clear-cart.contracts"
import { ClearCartCommand } from "./clear-cart.command"

@CommandHandler(ClearCartCommand)
/** Empties the caller cart in one transaction. */
export class ClearCartHandler extends ICQRSHandler<ClearCartCommand, ClearCartResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectOrderEntityManager() private readonly entityManager: EntityManager,
        private readonly cart: CartService,
    ) {
        super(logger)
    }

    protected override async process(command: ClearCartCommand): Promise<ClearCartResult> {
        const personId = command.params.principal.id
        await this.entityManager.transaction((manager) => this.cart.clear({ manager, personId }))
        return { cleared: true }
    }
}
