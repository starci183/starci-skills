import { CommandHandler } from "@nestjs/cqrs"
import { GeneratorService } from "@modules/domain/recur"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GenerateRecurrencesCommand } from "./generate-recurrences.command"
import type { GenerateRecurrencesResult } from "./generate-recurrences.contracts"

@CommandHandler(GenerateRecurrencesCommand)
/**
 * Materialises the occurrences the rules owe at the tick instant. The generator creates each task with the plan cap and
 * the audit line of a manual create, so an occurrence whose task was refused is owed again at the next tick.
 */
export class GenerateRecurrencesHandler extends ICQRSHandler<GenerateRecurrencesCommand, GenerateRecurrencesResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly generator: GeneratorService,
    ) {
        super(logger)
    }

    protected override async process(command: GenerateRecurrencesCommand): Promise<GenerateRecurrencesResult> {
        const { request } = command.params
        return this.generator.generate({ at: request.at })
    }
}
