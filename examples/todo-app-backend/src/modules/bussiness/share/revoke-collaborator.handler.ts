import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InvitationService } from './invitation.service';
import { RevokeCollaboratorCommand, RevokeCollaboratorCommandResult } from './revoke-collaborator.command';

/** fr.share.revoke composes br.share.revoke.on-read: the write that flips the row to revoked and, in the
 * same call, deletes the CollaboratorCache entry so the very next mayComplete already refuses - no sweep
 * involved. */
@Injectable()
@CommandHandler(RevokeCollaboratorCommand)
export class RevokeCollaboratorHandler implements ICommandHandler<RevokeCollaboratorCommand, RevokeCollaboratorCommandResult> {
  constructor(private readonly invitationService: InvitationService) {}

  async execute(command: RevokeCollaboratorCommand): Promise<RevokeCollaboratorCommandResult> {
    const { params } = command;
    const record = await this.invitationService.revoke(params.ownerId, params.invitationId);
    return { invitationId: record.id, status: record.status };
  }
}
