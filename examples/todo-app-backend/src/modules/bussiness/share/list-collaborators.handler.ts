import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InvitationService } from './invitation.service';
import { CollaboratorSummaryResult, ListCollaboratorsQuery, ListCollaboratorsQueryResult } from './list-collaborators.query';

/** fr.share.list: the owner or a bound collaborator sees every row's live status; a stranger sees
 * nothing (InvitationService.listFor returns an empty array either way). */
@Injectable()
@QueryHandler(ListCollaboratorsQuery)
export class ListCollaboratorsHandler implements IQueryHandler<ListCollaboratorsQuery, ListCollaboratorsQueryResult> {
  constructor(private readonly invitationService: InvitationService) {}

  async execute(query: ListCollaboratorsQuery): Promise<ListCollaboratorsQueryResult> {
    const records = await this.invitationService.listFor(query.params.actorId, query.params.taskId);
    const collaborators: CollaboratorSummaryResult[] = records.map(record => ({
      invitationId: record.id,
      email: record.email,
      role: record.role,
      status: record.status,
    }));
    return { collaborators };
  }
}
