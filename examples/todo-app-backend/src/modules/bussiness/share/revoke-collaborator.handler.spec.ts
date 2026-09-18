import { ShareInvitationEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { CollaboratorCache } from './collaborator-cache';
import { InvitationService } from './invitation.service';
import { RevokeCollaboratorCommand } from './revoke-collaborator.command';
import { RevokeCollaboratorHandler } from './revoke-collaborator.handler';

describe('RevokeCollaboratorHandler', () => {
  let invitationService: InvitationService;
  let handler: RevokeCollaboratorHandler;

  beforeEach(() => {
    invitationService = new InvitationService(createFakeEntityManager<ShareInvitationEntity>('id') as never, new CollaboratorCache());
    handler = new RevokeCollaboratorHandler(invitationService);
  });

  it('fr.share.revoke: the owner revokes a collaborator', async () => {
    const invited = await invitationService.invite('owner-1', 'task-1', 'collab@example.com', 'editor');
    const result = await handler.execute(new RevokeCollaboratorCommand({ ownerId: 'owner-1', invitationId: invited.id }));
    expect(result.status).toBe('revoked');
  });

  it('fr.share.revoke: a non-owner is refused', async () => {
    const invited = await invitationService.invite('owner-1', 'task-1', 'collab@example.com', 'editor');
    await expect(
      handler.execute(new RevokeCollaboratorCommand({ ownerId: 'someone-else', invitationId: invited.id })),
    ).rejects.toMatchObject({ code: 'SHARE_FORBIDDEN' });
  });
});
