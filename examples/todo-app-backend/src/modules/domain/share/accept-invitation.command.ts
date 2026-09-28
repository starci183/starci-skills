/** Contract naming the accept invitation command params shape domain/share code and its consumers share; a second site never retypes it inline. */
export interface AcceptInvitationCommandParams {
  readonly actorId: string;
  readonly invitationId: string;
  readonly email: string;
}

/** Contract naming the accept invitation command result shape domain/share code and its consumers share; a second site never retypes it inline. */
export interface AcceptInvitationCommandResult {
  readonly invitationId: string;
  readonly role: string;
  readonly status: string;
}

/** fr.share.accept as a CQRS write. */
export class AcceptInvitationCommand {
    constructor(readonly params: AcceptInvitationCommandParams) {}
}
