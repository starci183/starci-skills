import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { @@Action@@Request, @@Action@@Result } from "./@@action@@.contracts"

/** Asks to run @@action@@ for the caller. */
export class @@Action@@Command extends Command<@@Action@@Result> {
    constructor(readonly params: ExecuteParams<@@Action@@Request>) {
        super()
    }
}
