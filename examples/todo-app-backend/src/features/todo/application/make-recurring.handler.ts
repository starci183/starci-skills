import { CommandHandler } from "@nestjs/cqrs"
import { RuleService } from "@modules/domain/recur"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MakeRecurringCommand } from "./make-recurring.command"
import type { MakeRecurringResult } from "./make-recurring.contracts"

@CommandHandler(MakeRecurringCommand)
/**
 * Creates exactly one recurrence rule owned by the caller. A day of month that some months lack, such as the 31st, is
 * accepted: those months are skipped at generation. Only a shape that does not fit the frequency is refused.
 */
export class MakeRecurringHandler extends ICQRSHandler<MakeRecurringCommand, MakeRecurringResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly rules: RuleService,
    ) {
        super(logger)
    }

    protected override async process(command: MakeRecurringCommand): Promise<MakeRecurringResult> {
        return this.rules.create({ ownerId: command.params.principal.id, ...command.params.request })
    }
}
