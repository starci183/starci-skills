import type { FormEvent } from 'react';
import { Badge, Button, Input, PageContainer, SurfaceCard, SurfaceListCard, Text, TextAction, WorkspaceShell } from '@starci/grammar/common';
import type { Collaborator, ShareRole } from '@/modules/api/share';
import { Heading } from '@/components/leaves/Heading';
import { Link } from '@/components/leaves/Link';
import {
  SHARE_ACCOUNT_CLASS_NAME,
  SHARE_AVATAR_CLASS_NAME,
  SHARE_BODY_CLASS_NAME,
  SHARE_BREADCRUMB_CLASS_NAME,
  SHARE_COLLABORATOR_HEADER_CLASS_NAME,
  SHARE_COLLABORATOR_ROW_CLASS_NAME,
  SHARE_COLLABORATOR_ROWS_CLASS_NAME,
  SHARE_COMPACT_BAR_CLASS_NAME,
  SHARE_COMPACT_NAV_CLASS_NAME,
  SHARE_FIELDSET_CLASS_NAME,
  SHARE_FOOTER_LINKS_CLASS_NAME,
  SHARE_FORM_CLASS_NAME,
  SHARE_RADIO_INPUT_CLASS_NAME,
  SHARE_RADIO_ROW_CLASS_NAME,
  SHARE_TOP_BAR_CLASS_NAME,
  SHARE_TOP_NAV_CLASS_NAME,
} from './classNames';

const PRIMARY_NAVIGATION_LABEL = 'Primary destinations';
const MAIN_LANDMARK_LABEL = 'The invitation screen and the collaborator list';

/**
 * ui.share.invite states: empty, inviting, pending-list, accepted, refused. A state this record does
 * not name has no branch here. The connected owner in ./index.tsx resolves which state applies and
 * hands it down explicitly; this view never re-derives it from the query or mutation results.
 */
export type ShareInviteState = 'empty' | 'inviting' | 'pending-list' | 'accepted' | 'refused';

/** The one beside-it inventory the ShareInviteState closed vocabulary is checked against. */
export const SHARE_INVITE_STATES: ReadonlyArray<ShareInviteState> = ['empty', 'inviting', 'pending-list', 'accepted', 'refused'] as const;

/** The public props of the pure invitation-screen view. */
export type ShareInviteViewProps = {
  readonly state: ShareInviteState;
  readonly collaborators: ReadonlyArray<Collaborator>;
  readonly taskTitle: string | null;
  readonly refusal: string | null;
  /** Where the refused submission's assertive sentence belongs: on the email field, or on the form. */
  readonly refusalTarget: 'email' | 'form';
  readonly email: string;
  readonly role: ShareRole;
  readonly revokingId: string | null;
  readonly onEmailChange: (value: string) => void;
  readonly onRoleChange: (role: ShareRole) => void;
  readonly onInvite: () => void;
  readonly onRevoke: (invitationId: string, email: string) => void;
  readonly onSignOut: () => void;
};

const labelOf = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/** fr.share.revoke: only a live (pending or accepted) invitation can still be revoked. */
const isRevocable = (collaborator: Collaborator): boolean =>
  collaborator.status === 'pending' || collaborator.status === 'accepted';

/** The pure render of ui.share.invite; every one of its five states is decided by the caller's `state`. */
export const ShareInviteView = (props: ShareInviteViewProps) => {
  const state = props.state;
  const inviting = state === 'inviting';
  const onInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    props.onInvite();
  };

  const destinations = (
    <>
      <Link to="/tasks" appearance="tab" isCurrent>Tasks</Link>
      <Link to="/notify/preferences" appearance="tab">Notifications</Link>
      <Link to="/plan/usage" appearance="tab">Plan</Link>
      <Link to="/privacy" appearance="tab">Privacy</Link>
    </>
  );

  const account = (
    <div className={SHARE_ACCOUNT_CLASS_NAME}>
      <span aria-hidden="true" className={SHARE_AVATAR_CLASS_NAME}>A</span>
      <Text>Alex</Text>
      <TextAction appearance="inline" onPress={props.onSignOut}>Sign out</TextAction>
    </div>
  );

  return (
    <WorkspaceShell
      mainLandmark="caller"
      header={(
        <div className={SHARE_TOP_BAR_CLASS_NAME}>
          <Text weight="semibold">Todo app</Text>
          <nav aria-label={PRIMARY_NAVIGATION_LABEL} className={SHARE_TOP_NAV_CLASS_NAME}>{destinations}</nav>
          {account}
        </div>
      )}
      compactHeader={(
        <div className={SHARE_COMPACT_BAR_CLASS_NAME}>
          <Text weight="semibold">Todo app</Text>
          {account}
        </div>
      )}
      compactNavigation={<div className={SHARE_COMPACT_NAV_CLASS_NAME}>{destinations}</div>}
      compactNavigationLabel={PRIMARY_NAVIGATION_LABEL}
      primary={(
        <PageContainer role="main" aria-label={MAIN_LANDMARK_LABEL} measure="product">
          <div data-state={state} className={SHARE_BODY_CLASS_NAME}>
      <nav aria-label="Breadcrumb" className={SHARE_BREADCRUMB_CLASS_NAME}>
        <Link to="/tasks" appearance="inline" size="sm">Tasks</Link>
        <span aria-hidden="true"><Text as="span" tone="muted" size="sm">/</Text></span>
        {props.taskTitle === null ? null : (
          <>
            <Link to="/tasks" appearance="inline" size="sm">{props.taskTitle}</Link>
            <span aria-hidden="true"><Text as="span" tone="muted" size="sm">/</Text></span>
          </>
        )}
        <Text as="span" size="sm">Sharing</Text>
      </nav>

      <div>
        <Heading level={1}>Share this task</Heading>
        {props.taskTitle === null ? null : <Text tone="muted">{props.taskTitle}</Text>}
      </div>

      <Link to="/tasks" appearance="inline">Back to task</Link>

      <SurfaceCard ariaLabel="Invite collaborators">
        <Text weight="semibold">Invite a collaborator</Text>
        <Text tone="muted" size="sm">Choose who can view or edit this task.</Text>
        <form onSubmit={onInvite} noValidate className={SHARE_FORM_CLASS_NAME}>
          <Input
            id="invite-email"
            name="email"
            label="Email address"
            kind="email"
            value={props.email}
            onValueChange={props.onEmailChange}
            isRequired
            isDisabled={inviting}
            errorMessage={
              state === 'refused' && props.refusalTarget === 'email' && props.refusal !== null
                ? <Text as="span" live="assertive" size="sm">{props.refusal}</Text>
                : undefined
            }
          />
          <fieldset className={SHARE_FIELDSET_CLASS_NAME}>
            <legend><Text as="span" weight="medium" size="sm">Role</Text></legend>
            <label className={SHARE_RADIO_ROW_CLASS_NAME}>
              <input
                type="radio"
                name="invite-role"
                value="viewer"
                checked={props.role === 'viewer'}
                disabled={inviting}
                onChange={() => props.onRoleChange('viewer')}
                className={SHARE_RADIO_INPUT_CLASS_NAME}
              />
              <Text as="span">Viewer</Text>
            </label>
            <label className={SHARE_RADIO_ROW_CLASS_NAME}>
              <input
                type="radio"
                name="invite-role"
                value="editor"
                checked={props.role === 'editor'}
                disabled={inviting}
                onChange={() => props.onRoleChange('editor')}
                className={SHARE_RADIO_INPUT_CLASS_NAME}
              />
              <Text as="span">Editor</Text>
            </label>
            <Text tone="muted" size="sm">Viewers can read. Editors can complete the task.</Text>
          </fieldset>
          <div>
            <Button type="submit" variant="primary" isDisabled={inviting} isPending={inviting}>
              Send invitation
            </Button>
          </div>
        </form>
      </SurfaceCard>

      {state === 'refused' && props.refusalTarget === 'form' && props.refusal !== null ? (
        <Text live="assertive">{props.refusal}</Text>
      ) : null}

      {props.collaborators.length === 0 ? null : (
        <SurfaceListCard
          label="Collaborators"
          footer={<Text tone="muted" size="sm">Pending invitations expire after 14 days.</Text>}
        >
          <div className={SHARE_COLLABORATOR_HEADER_CLASS_NAME}>
            <Text as="span" tone="muted" size="sm" weight="medium">Person</Text>
            <Text as="span" tone="muted" size="sm" weight="medium">Access</Text>
            <Text as="span" tone="muted" size="sm" weight="medium">Status</Text>
            <span aria-hidden="true" />
          </div>
          <ul className={SHARE_COLLABORATOR_ROWS_CLASS_NAME}>
            {props.collaborators.map(collaborator => (
              <li key={collaborator.id} className={SHARE_COLLABORATOR_ROW_CLASS_NAME}>
                <Text overflow="truncate">{collaborator.email}</Text>
                <Text>{labelOf(collaborator.role)}</Text>
                <div><Badge tone="neutral">{labelOf(collaborator.status)}</Badge></div>
                {isRevocable(collaborator) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    isPending={props.revokingId === collaborator.id}
                    isDisabled={props.revokingId !== null}
                    onPress={() => props.onRevoke(collaborator.id, collaborator.email)}
                  >
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </SurfaceListCard>
      )}

      <footer className={SHARE_FOOTER_LINKS_CLASS_NAME}>
        <Link to="/privacy-policy" appearance="inline" size="sm">Privacy policy</Link>
        <Link to="/terms" appearance="inline" size="sm">Terms</Link>
      </footer>
          </div>
        </PageContainer>
      )}
    />
  );
};
