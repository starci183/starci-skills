import { CommandHandler } from "@nestjs/cqrs"
import { @@service@@ } from "@@serviceModule@@"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { Undo@@Saga@@Command } from "./undo-@@saga@@.command"

@CommandHandler(Undo@@Saga@@Command)
/** Undoes the @@saga@@ saga for an id; @@service@@ decides the transaction and the no-op of a redelivery (`undo@@Saga@@`). */
export class Undo@@Saga@@Handler extends ICQRSHandler<Undo@@Saga@@Command, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly domain: @@service@@,
    ) {
        super(logger)
    }

    protected override process(command: Undo@@Saga@@Command): Promise<void> {
        return this.domain.undo@@Saga@@({ id: command.params.request.id })
    }
}
