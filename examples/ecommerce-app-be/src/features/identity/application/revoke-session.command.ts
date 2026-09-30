import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RevokeSessionRequest, RevokeSessionResult } from "./revoke-session.contracts"

/** Asks to end one of the caller sessions. */
export class RevokeSessionCommand extends Command<RevokeSessionResult> {
    constructor(readonly params: ExecuteParams<RevokeSessionRequest>) {
        super()
    }
}
