import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as graphqlModule from './graphql';
import { listCollaborators, inviteCollaborator, revokeCollaborator } from './share';

vi.mock('./graphql', async () => {
  const actual = await vi.importActual<typeof graphqlModule>('./graphql');
  return { ...actual, graphql: vi.fn() };
});

const mockedGraphql = () => graphqlModule.graphql as unknown as ReturnType<typeof vi.fn>;

describe('listCollaborators', () => {
  beforeEach(() => mockedGraphql().mockReset());

  it('projects the collaborators query result into the Collaborator shape (fr.share.list)', async () => {
    mockedGraphql().mockResolvedValueOnce({
      ok: true,
      data: [
        { invitationId: 'i-1', email: 'sam@example.test', role: 'editor', status: 'accepted' },
        { invitationId: 'i-2', email: 'lee@example.test', role: 'viewer', status: 'pending' },
      ],
    });

    await expect(listCollaborators('tok-1', 'task-1')).resolves.toEqual([
      { id: 'i-1', email: 'sam@example.test', role: 'editor', status: 'accepted' },
      { id: 'i-2', email: 'lee@example.test', role: 'viewer', status: 'pending' },
    ]);
    expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining('collaborators'), { taskId: 'task-1' }, 'tok-1');
  });

  it('throws when the transport refuses (an expired or missing session)', async () => {
    mockedGraphql().mockResolvedValueOnce({ ok: false, reason: 'The session is not active.', code: 'SESSION_NOT_FOUND' });

    await expect(listCollaborators('tok-1', 'task-1')).rejects.toThrow('The session is not active.');
  });
});

describe('inviteCollaborator', () => {
  beforeEach(() => mockedGraphql().mockReset());

  it('sends the task, email and role as one InviteInput and projects the created invitation (fr.share.invite)', async () => {
    mockedGraphql().mockResolvedValueOnce({
      ok: true,
      data: { invitationId: 'i-3', taskId: 'task-1', email: 'lee@example.test', role: 'viewer', status: 'pending' },
    });

    await expect(inviteCollaborator('tok-1', 'task-1', 'lee@example.test', 'viewer')).resolves.toEqual({
      id: 'i-3',
      email: 'lee@example.test',
      role: 'viewer',
      status: 'pending',
    });
    expect(mockedGraphql()).toHaveBeenCalledWith(
      expect.stringContaining('invite'),
      { input: { taskId: 'task-1', email: 'lee@example.test', role: 'viewer' } },
      'tok-1',
    );
  });

  it('throws the refusal with its stable code on cause when the email is not well formed', async () => {
    mockedGraphql().mockResolvedValueOnce({
      ok: false,
      reason: 'That email address is not well formed.',
      code: 'SHARE_INVALID_EMAIL',
    });

    const rejection = inviteCollaborator('tok-1', 'task-1', 'jamie@', 'viewer');
    await expect(rejection).rejects.toThrow('That email address is not well formed.');
    await expect(rejection).rejects.toMatchObject({ cause: expect.objectContaining({ message: 'SHARE_INVALID_EMAIL' }) });
  });
});

describe('revokeCollaborator', () => {
  beforeEach(() => mockedGraphql().mockReset());

  it('resolves with nothing once the backend confirms the revoke (fr.share.revoke)', async () => {
    mockedGraphql().mockResolvedValueOnce({ ok: true, data: { invitationId: 'i-1', status: 'revoked' } });

    await expect(revokeCollaborator('tok-1', 'i-1')).resolves.toBeUndefined();
    expect(mockedGraphql()).toHaveBeenCalledWith(
      expect.stringContaining('revokeCollaborator'),
      { input: { invitationId: 'i-1' } },
      'tok-1',
    );
  });

  it('throws when the invitation is already closed', async () => {
    mockedGraphql().mockResolvedValueOnce({
      ok: false,
      reason: 'That invitation is already closed.',
      code: 'SHARE_INVITATION_ALREADY_CLOSED',
    });

    await expect(revokeCollaborator('tok-1', 'i-1')).rejects.toThrow('That invitation is already closed.');
  });
});
