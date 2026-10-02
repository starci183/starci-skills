import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { @@Action@@Request, @@Action@@Result } from "./@@action@@.contracts"

/** Asks to run @@action@@ for an operator. */
export class @@Action@@Command extends Command<@@Action@@Result> {
    constructor(readonly params: PublicExecuteParams<@@Action@@Request>) {
        super()
    }
}
