import { graphql, type Result } from './graphql';
import { runWrite } from './write-feedback';

/** br.share.role.permissions: a collaborator is a viewer or an editor, never anything else. */
export type ShareRole = 'viewer' | 'editor';

/** sds.share.invitation-lifecycle: the live status fr.share.list returns, recomputed on every read. */
export type ShareInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/** The one shape a collaborator row takes on the wire and in the collaborator list. */
export interface Collaborator {
  readonly id: string;
  readonly email: string;
  readonly role: ShareRole;
  readonly status: ShareInvitationStatus;
}

/** Same unwrapping convention as tasks.ts: a refused GraphQL `Result` becomes the thrown `Error` a
 * `useSWR`/`useSWRMutation` caller already expects, with the backend's stable code kept on `cause`. */
const unwrap = <T>(result: Result<T>): T => {
  if (!result.ok) {
    throw new Error(result.reason, result.code ? { cause: new Error(result.code) } : undefined);
  }
  return result.data;
};

interface CollaboratorSummary {
  readonly invitationId: string;
  readonly email: string;
  readonly role: string;
  readonly status: string;
}

const toCollaborator = (summary: CollaboratorSummary): Collaborator => ({
  id: summary.invitationId,
  email: summary.email,
  role: summary.role as ShareRole,
  status: summary.status as ShareInvitationStatus,
});

const LIST_COLLABORATORS_DOCUMENT =
  'query Collaborators($taskId: ID!) { collaborators(taskId: $taskId) { invitationId email role status } }';

/**
 * fr.share.list: reads the task's collaborators as the owner (or a bound collaborator) sees them; a
 * stranger reads nothing, matching the record's own exceptionFlow. A missing or expired token surfaces
 * as a transport refusal.
 */
export const listCollaborators = async (token: string, taskId: string): Promise<ReadonlyArray<Collaborator>> => {
  const result = await graphql<Array<CollaboratorSummary>>(LIST_COLLABORATORS_DOCUMENT, { taskId }, token);
  return unwrap(result).map(toCollaborator);
};

const INVITE_DOCUMENT =
  'mutation Invite($input: InviteInput!) { invite(input: $input) { invitationId taskId email role status } }';

/**
 * fr.share.invite: submits one email and one viewer/editor role for the owner's own task; an invalid
 * email or role is refused (SHARE_INVALID_EMAIL / SHARE_INVALID_ROLE on the error's `cause`) and
 * nothing is created.
 */
export const inviteCollaborator = async (
  token: string,
  taskId: string,
  email: string,
  role: ShareRole,
): Promise<Collaborator> => {
  const result = await graphql<CollaboratorSummary & { readonly taskId: string }>(
    INVITE_DOCUMENT,
    { input: { taskId, email, role } },
    token,
  );
  return toCollaborator(unwrap(result));
};

const REVOKE_COLLABORATOR_DOCUMENT =
  'mutation RevokeCollaborator($input: RevokeCollaboratorInput!) { revokeCollaborator(input: $input) { invitationId status } }';

/**
 * fr.share.revoke: revokes one pending or accepted invitation on the owner's own task; revoking an
 * already expired or already revoked invitation is refused.
 */
export const revokeCollaborator = async (token: string, invitationId: string): Promise<void> => {
  unwrap(await graphql<{ invitationId: string; status: string }>(REVOKE_COLLABORATOR_DOCUMENT, { input: { invitationId } }, token));
};

/** The declared feedback site for the invite write action (FE_WRITE_FEEDBACK_OWNER). */
export const inviteCollaboratorAndNotify = (token: string, taskId: string, email: string, role: ShareRole): Promise<Collaborator> => {
  return runWrite(() => inviteCollaborator(token, taskId, email, role));
};

/** The declared feedback site for the revoke write action (FE_WRITE_FEEDBACK_OWNER). */
export const revokeCollaboratorAndNotify = (token: string, invitationId: string): Promise<void> => {
  return runWrite(() => revokeCollaborator(token, invitationId));
};
