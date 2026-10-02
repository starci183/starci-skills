import { Command } from "@nestjs/cqrs"
import type { Principal } from "@modules/domain/identity"
import type { @@Action@@Request, @@Action@@Result } from "./@@action@@.contracts"

/** Asks to run @@action@@ for the authenticated caller. */
export class @@Action@@Command extends Command<@@Action@@Result> {
    constructor(readonly params: { readonly request: @@Action@@Request; readonly principal: Principal }) {
        super()
    }
}
