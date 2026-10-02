import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SagaTransition } from "@modules/platform/saga"
import type { Complete@@Saga@@Request } from "./complete-@@saga@@.contracts"

/** Asks to complete the @@saga@@ saga of an id whose answer arrived; the @@done@@ consumer sends it for every delivered event. */
export class Complete@@Saga@@Command extends Command<SagaTransition> {
    constructor(readonly params: PublicExecuteParams<Complete@@Saga@@Request>) {
        super()
    }
}
