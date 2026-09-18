import { ShareInvitationEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { CollaboratorCache } from './collaborator-cache';
import { InvitationService } from './invitation.service';
import { InviteCommand } from './invite.command';
import { InviteHandler } from './invite.handler';

describe('InviteHandler', () => {
  let invitationService: InvitationService;
  let handler: InviteHandler;

  beforeEach(() => {
    invitationService = new InvitationService(createFakeEntityManager<ShareInvitationEntity>('id') as never, new CollaboratorCache());
    handler = new InviteHandler(invitationService);
  });

  it('fr.share.invite: dispatches to InvitationService and returns the pending invitation', async () => {
    const result = await handler.execute(new InviteCommand({ ownerId: 'owner-1', taskId: 'task-1', email: 'collab@example.com', role: 'editor' }));
    expect(result.status).toBe('pending');
    expect(result.role).toBe('editor');
    expect(result.taskId).toBe('task-1');
    expect(result.invitationId).toBeTruthy();
  });
});
