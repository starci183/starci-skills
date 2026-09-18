import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvitationService } from './invitation.service';
import { AcceptInvitationCommand, AcceptInvitationCommandResult } from './accept-invitation.command';

/** fr.share.accept composes br.share.invite.expiry (the window guard) and br.share.role.permissions (the
 * accepted role becomes active immediately, through InvitationService binding personId into the
 * synchronous CollaboratorCache in the same call that persists the row). */
@Injectable()
@CommandHandler(AcceptInvitationCommand)
export class AcceptInvitationHandler implements ICommandHandler<AcceptInvitationCommand, AcceptInvitationCommandResult> {
  constructor(private readonly invitationService: InvitationService) {}

  async execute(command: AcceptInvitationCommand): Promise<AcceptInvitationCommandResult> {
    const { params } = command;
    const record = await this.invitationService.accept(params.actorId, params.invitationId, params.email);
    return { invitationId: record.id, role: record.role, status: record.status };
  }
}
