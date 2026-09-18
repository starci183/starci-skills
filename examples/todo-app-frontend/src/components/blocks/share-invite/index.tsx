'use client';

import { useState } from 'react';
import { useCollaborators, useInviteCollaborator, useRevokeCollaborator, useTaskTitle } from '@/hooks/share';
import { useSignOut } from '@/hooks/auth';
import type { ShareRole } from '@/modules/api/share';
import { ShareInviteView, type ShareInviteState } from './component';

const READ_REFUSAL_MESSAGE = "Your session has ended. Sign in again to see this task's collaborators.";
const INVALID_EMAIL_MESSAGE = 'Enter a valid email address.';
const EMAIL_FIELD_CODES = new Set(['SHARE_INVALID_EMAIL', 'SHARE_INVITATION_ALREADY_EXISTS']);

const messageOf = (error: unknown): string | null => (error instanceof Error ? error.message : null);
const codeOf = (error: unknown): string | null =>
  error instanceof Error && error.cause instanceof Error ? error.cause.message : null;

/** ShareInviteBlock's only external input: the task this screen shares, from the route's own params. */
export type ShareInviteBlockProps = {
  readonly taskId: string;
};

/**
 * The connected owner of ui.share.invite: it owns the collaborators query, the invite and revoke
 * mutations, the email/role draft, resolves the one state ShareInviteView renders, and hands the
 * only render path to the pure ShareInviteView in ./component.tsx.
 */
export const ShareInviteBlock = (props: ShareInviteBlockProps) => {
  const taskId = props.taskId;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ShareRole>('viewer');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const collaboratorsQuery = useCollaborators(taskId);
  const invite = useInviteCollaborator(taskId);
  const revoke = useRevokeCollaborator(taskId);
  const taskTitleQuery = useTaskTitle(taskId);
  const signOut = useSignOut();

  const collaborators = collaboratorsQuery.data ?? [];
  const inviteCode = codeOf(invite.error);
  const refusal = collaboratorsQuery.error
    ? READ_REFUSAL_MESSAGE
    : invite.error
      ? inviteCode === 'SHARE_INVALID_EMAIL'
        ? INVALID_EMAIL_MESSAGE
        : messageOf(invite.error)
      : messageOf(revoke.error);
  const refusalTarget: 'email' | 'form' = inviteCode !== null && EMAIL_FIELD_CODES.has(inviteCode) ? 'email' : 'form';

  const state: ShareInviteState = Boolean(collaboratorsQuery.error || invite.error || revoke.error)
    ? 'refused'
    : invite.isMutating
      ? 'inviting'
      : collaborators.some(collaborator => collaborator.status === 'accepted')
        ? 'accepted'
        : collaborators.length > 0
          ? 'pending-list'
          : 'empty';

  const onInvite = () => {
    void invite
      .trigger({ email: email.trim(), role })
      .then(() => setEmail(''))
      .catch(() => {});
  };

  const onRevoke = (invitationId: string, collaboratorEmail: string) => {
    if (!window.confirm(`Revoke ${collaboratorEmail}'s access to this task?`)) return;
    setRevokingId(invitationId);
    void revoke
      .trigger({ invitationId })
      .catch(() => {})
      .finally(() => setRevokingId(null));
  };

  return (
    <ShareInviteView
      state={state}
      collaborators={collaborators}
      taskTitle={taskTitleQuery.data ?? null}
      refusal={refusal}
      refusalTarget={refusalTarget}
      email={email}
      role={role}
      revokingId={revokingId}
      onEmailChange={setEmail}
      onRoleChange={setRole}
      onInvite={onInvite}
      onRevoke={onRevoke}
      onSignOut={signOut}
    />
  );
};
