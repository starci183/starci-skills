import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SagaTransition } from "@modules/platform/saga"
import type { Compensate@@Saga@@Request } from "./compensate-@@saga@@.contracts"

/** Asks to compensate the @@saga@@ saga of an id whose answer failed; the @@failed@@ consumer sends it for every delivered event. */
export class Compensate@@Saga@@Command extends Command<SagaTransition> {
    constructor(readonly params: PublicExecuteParams<Compensate@@Saga@@Request>) {
        super()
    }
}
