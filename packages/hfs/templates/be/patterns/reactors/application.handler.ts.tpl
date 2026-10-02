import { CommandHandler } from "@nestjs/cqrs"
import { @@service@@ } from "@@serviceModule@@"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { @@Action@@Result } from "./@@action@@.contracts"
import { @@Action@@Command } from "./@@action@@.command"

@CommandHandler(@@Action@@Command)
/** Hands the delivered @@event@@ event to the domain service, which claims the event id and applies the change in one transaction. */
export class @@Action@@Handler extends ICQRSHandler<@@Action@@Command, @@Action@@Result> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly @@serviceCamel@@: @@service@@,
    ) {
        super(logger)
    }

    protected override process(command: @@Action@@Command): Promise<@@Action@@Result> {
        return this.@@serviceCamel@@.apply(command.params.request)
    }
}
