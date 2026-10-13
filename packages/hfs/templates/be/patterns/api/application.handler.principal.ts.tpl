import { CommandHandler } from "@nestjs/cqrs"
import { @@service@@ } from "@@serviceModule@@"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { @@Action@@Result } from "./@@action@@.contracts"
import { @@Action@@Command } from "./@@action@@.command"

@CommandHandler(@@Action@@Command)
/** Runs @@action@@ for the authenticated principal through one domain-service call. */
export class @@Action@@Handler extends ICQRSHandler<@@Action@@Command, @@Action@@Result> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly @@serviceCamel@@: @@service@@,
    ) {
        super(logger)
    }

    protected override process(command: @@Action@@Command): Promise<@@Action@@Result> {
        return this.@@serviceCamel@@.@@actionCamel@@(command.params.principal.id, command.params.request.id)
    }
}
