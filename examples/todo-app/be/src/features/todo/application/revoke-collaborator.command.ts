import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RevokeCollaboratorRequest, RevokeCollaboratorResult } from "./revoke-collaborator.contracts"

/** Asks to revoke a collaborator invitation the caller owns. */
export class RevokeCollaboratorCommand extends Command<RevokeCollaboratorResult> {
    constructor(readonly params: ExecuteParams<RevokeCollaboratorRequest>) {
        super()
    }
}
