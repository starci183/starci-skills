import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { Undo@@Saga@@Request } from "./undo-@@saga@@.contracts"

/** Asks to undo what the @@saga@@ saga did for an id; the compensation of its step sends it. */
export class Undo@@Saga@@Command extends Command<void> {
    constructor(readonly params: PublicExecuteParams<Undo@@Saga@@Request>) {
        super()
    }
}
