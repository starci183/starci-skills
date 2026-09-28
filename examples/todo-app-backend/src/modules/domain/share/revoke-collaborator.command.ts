/** Contract naming the revoke collaborator command params shape domain/share code and its consumers share; a second site never retypes it inline. */
export interface RevokeCollaboratorCommandParams {
  readonly ownerId: string;
  readonly invitationId: string;
}

/** Contract naming the revoke collaborator command result shape domain/share code and its consumers share; a second site never retypes it inline. */
export interface RevokeCollaboratorCommandResult {
  readonly invitationId: string;
  readonly status: string;
}

/** fr.share.revoke as a CQRS write. */
export class RevokeCollaboratorCommand {
    constructor(readonly params: RevokeCollaboratorCommandParams) {}
}
