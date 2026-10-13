import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { Get{{Singular}}Request, Get{{Singular}}Result } from "./get-{{singular}}.contracts"

/** Asks for one {{singular}} row the authenticated caller owns. */
export class Get{{Singular}}Query extends Query<Get{{Singular}}Result> {
    constructor(readonly params: ExecuteParams<Get{{Singular}}Request>) {
        super()
    }
}
