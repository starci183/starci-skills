import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { Create{{Singular}}Request, Create{{Singular}}Result } from "./create-{{singular}}.contracts"

/** Asks to create one {{singular}} row owned by the authenticated caller. */
export class Create{{Singular}}Command extends Command<Create{{Singular}}Result> {
    constructor(readonly params: ExecuteParams<Create{{Singular}}Request>) {
        super()
    }
}
