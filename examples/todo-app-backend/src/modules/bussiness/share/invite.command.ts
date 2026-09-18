export interface InviteCommandParams {
  readonly ownerId: string;
  readonly taskId: string;
  readonly email: string;
  readonly role: string;
}

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
