export interface RevokeCollaboratorCommandParams {
  readonly ownerId: string;
  readonly invitationId: string;
}

export interface RevokeCollaboratorCommandResult {
  readonly invitationId: string;
  readonly status: string;
}

/** fr.share.revoke as a CQRS write. */
export class RevokeCollaboratorCommand {
  constructor(readonly params: RevokeCollaboratorCommandParams) {}
}
