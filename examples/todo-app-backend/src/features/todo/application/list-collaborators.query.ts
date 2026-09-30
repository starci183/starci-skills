import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListCollaboratorsRequest, ListCollaboratorsResult } from "./list-collaborators.contracts"

/** Asks for the invitations on a task. */
export class ListCollaboratorsQuery extends Query<ListCollaboratorsResult> {
    constructor(readonly params: ExecuteParams<ListCollaboratorsRequest>) {
        super()
    }
}
