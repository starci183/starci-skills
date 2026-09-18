import { ShareInvitationEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { CollaboratorCache } from './collaborator-cache';
import { InvitationService } from './invitation.service';
import { ListCollaboratorsQuery } from './list-collaborators.query';
import { ListCollaboratorsHandler } from './list-collaborators.handler';

describe('ListCollaboratorsHandler', () => {
  let invitationService: InvitationService;
  let handler: ListCollaboratorsHandler;

  beforeEach(() => {
    invitationService = new InvitationService(createFakeEntityManager<ShareInvitationEntity>('id') as never, new CollaboratorCache());
    handler = new ListCollaboratorsHandler(invitationService);
  });

  it('fr.share.list: the owner sees every collaborator with a live status', async () => {
    await invitationService.invite('owner-1', 'task-1', 'collab@example.com', 'editor');
    const result = await handler.execute(new ListCollaboratorsQuery({ actorId: 'owner-1', taskId: 'task-1' }));
    expect(result.collaborators).toHaveLength(1);
    expect(result.collaborators[0].status).toBe('pending');
  });

  it('fr.share.list exceptionFlows: a stranger sees nothing', async () => {
    await invitationService.invite('owner-1', 'task-1', 'collab@example.com', 'editor');
    const result = await handler.execute(new ListCollaboratorsQuery({ actorId: 'a-stranger', taskId: 'task-1' }));
    expect(result.collaborators).toEqual([]);
  });
});
