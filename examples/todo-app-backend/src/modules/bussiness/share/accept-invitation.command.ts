export interface AcceptInvitationCommandParams {
  readonly actorId: string;
  readonly invitationId: string;
  readonly email: string;
}

export interface AcceptInvitationCommandResult {
  readonly invitationId: string;
  readonly role: string;
  readonly status: string;
}

/** fr.share.accept as a CQRS write. */
export class AcceptInvitationCommand {
  constructor(readonly params: AcceptInvitationCommandParams) {}
}
