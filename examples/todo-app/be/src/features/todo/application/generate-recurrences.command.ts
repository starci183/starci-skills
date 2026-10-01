import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { GenerateRecurrencesRequest, GenerateRecurrencesResult } from "./generate-recurrences.contracts"

/** Asks for the due occurrences of every recurrence rule to be materialised; sent by the generation tick, never by a person. */
export class GenerateRecurrencesCommand extends Command<GenerateRecurrencesResult> {
    constructor(readonly params: PublicExecuteParams<GenerateRecurrencesRequest>) {
        super()
    }
}
