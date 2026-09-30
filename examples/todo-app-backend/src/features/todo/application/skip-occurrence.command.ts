import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SkipOccurrenceRequest, SkipOccurrenceResult } from "./skip-occurrence.contracts"

/** Asks to skip an occurrence of a rule of the caller without completing its task. */
export class SkipOccurrenceCommand extends Command<SkipOccurrenceResult> {
    constructor(readonly params: ExecuteParams<SkipOccurrenceRequest>) {
        super()
    }
}
