/** Contract naming the invite command params shape bussiness/share code and its consumers share; a second site never retypes it inline. */
export interface InviteCommandParams {
  readonly ownerId: string;
  readonly taskId: string;
  readonly email: string;
  readonly role: string;
}

/** Contract naming the invite command result shape bussiness/share code and its consumers share; a second site never retypes it inline. */
export interface InviteCommandResult {
  readonly invitationId: string;
  readonly taskId: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
}

/** fr.share.invite as a CQRS write. */
export class InviteCommand {
    constructor(readonly params: InviteCommandParams) {}
}
