import type { FormEvent } from "react"
import { Badge, Button, Input, PageContainer, SurfaceCard, Text, TextAction, WorkspaceShell } from "@starci/grammar/common"
import type { Collaborator, ShareRole } from "@/modules/api/share"
import { Heading } from "@/components/leaves/Heading"
import { Link } from "@/components/leaves/Link"
import {
    SHARE_ACCOUNT_CLASS_NAME,
    SHARE_AVATAR_CLASS_NAME,
    SHARE_BODY_CLASS_NAME,
    SHARE_BREADCRUMB_CLASS_NAME,
    SHARE_COLLABORATOR_HEADER_CLASS_NAME,
    SHARE_COLLABORATOR_SECTION_CLASS_NAME,
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
} from "./classNames"

/**
 * ui.share.invite states: empty, inviting, pending-list, accepted, refused. A state this record does
 * not name has no branch here. The connected owner in ./index.tsx resolves which state applies and
 * hands it down explicitly; this view never re-derives it from the query or mutation results.
 */
export type ShareInviteState = "empty" | "inviting" | "pending-list" | "accepted" | "refused";

/** The one beside-it inventory the ShareInviteState closed vocabulary is checked against. */
export const SHARE_INVITE_STATES: ReadonlyArray<ShareInviteState> = ["empty", "inviting", "pending-list", "accepted", "refused"] as const

/** The four destinations every signed-in screen names, and the pair its footer names. */
type ShellLinkCopy = {
  readonly tasks: string;
  readonly notifications: string;
  readonly plan: string;
  readonly privacy: string;
};

/** Every word the pure invitation screen renders, resolved by the connected half. */
export type ShareInviteViewCopy = {
  readonly brand: string;
  readonly accountName: string;
  readonly signOut: string;
  /** The accessible name of the destination row, in the header and in the compact band alike. */
  readonly navLabel: string;
  readonly breadcrumbLabel: string;
  readonly destinations: ShellLinkCopy;
  readonly legal: {
    readonly privacyPolicy: string;
    readonly terms: string;
  };
  readonly backToTask: string;
  /** The main landmark's accessible name. */
  readonly mainLabel: string;
  readonly breadcrumbSharing: string;
  readonly heading: string;
  readonly cardLabel: string;
  readonly inviteHeading: string;
  readonly inviteTagline: string;
  readonly emailLabel: string;
  readonly roleLabel: string;
  /** The invitation's two roles, keyed by the wire value. */
  readonly roles: {
    readonly viewer: string;
    readonly editor: string;
  };
  readonly roleHint: string;
  readonly sendInvitation: string;
  readonly collaborators: string;
  readonly pendingExpiry: string;
  readonly columnPerson: string;
  readonly columnAccess: string;
  readonly columnStatus: string;
  /** The invitation lifecycle's four states, keyed by the wire value. */
  readonly statuses: {
    readonly pending: string;
    readonly accepted: string;
    readonly expired: string;
    readonly revoked: string;
  };
  readonly revoke: string;
};

/** The public props of the pure invitation-screen view. */
export type ShareInviteViewProps = {
  readonly state: ShareInviteState;
  readonly collaborators: ReadonlyArray<Collaborator>;
  readonly taskTitle: string | null;
  readonly refusal: string | null;
  /** Where the refused submission's assertive sentence belongs: on the email field, or on the form. */
  readonly refusalTarget: "email" | "form";
  readonly email: string;
  readonly role: ShareRole;
  readonly revokingId: string | null;
  readonly copy: ShareInviteViewCopy;
  readonly onEmailChange: (value: string) => void;
  readonly onRoleChange: (role: ShareRole) => void;
  readonly onInvite: () => void;
  readonly onRevoke: (invitationId: string, email: string) => void;
  readonly onSignOut: () => void;
};

/** fr.share.revoke: only a live (pending or accepted) invitation can still be revoked. */
const isRevocable = (collaborator: Collaborator): boolean =>
    collaborator.status === "pending" || collaborator.status === "accepted"

/** The pure render of ui.share.invite; every one of its five states is decided by the caller's
 * `state`, and every word it draws arrives resolved through `copy`. */
export const ShareInviteView = (props: ShareInviteViewProps) => {
    const copy = props.copy
    const state = props.state
    const inviting = state === "inviting"
    const onInvite = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        props.onInvite()
    }

    const destinations = (
        <>
            <Link to="/tasks" appearance="tab" isCurrent>{copy.destinations.tasks}</Link>
            <Link to="/notify/preferences" appearance="tab">{copy.destinations.notifications}</Link>
            <Link to="/plan/usage" appearance="tab">{copy.destinations.plan}</Link>
            <Link to="/privacy" appearance="tab">{copy.destinations.privacy}</Link>
        </>
    )

    const account = (
        <div className={SHARE_ACCOUNT_CLASS_NAME}>
            <span aria-hidden="true" className={SHARE_AVATAR_CLASS_NAME}>A</span>
            <Text>{copy.accountName}</Text>
            <TextAction appearance="inline" onPress={props.onSignOut}>{copy.signOut}</TextAction>
        </div>
    )

    return (
        <WorkspaceShell
            mainLandmark="caller"
            header={(
                <div className={SHARE_TOP_BAR_CLASS_NAME}>
                    <Text weight="semibold">{copy.brand}</Text>
                    <nav aria-label={copy.navLabel} className={SHARE_TOP_NAV_CLASS_NAME}>{destinations}</nav>
                    {account}
                </div>
            )}
            compactHeader={(
                <div className={SHARE_COMPACT_BAR_CLASS_NAME}>
                    <Text weight="semibold">{copy.brand}</Text>
                    {account}
                </div>
            )}
            compactNavigation={<div className={SHARE_COMPACT_NAV_CLASS_NAME}>{destinations}</div>}
            compactNavigationLabel={copy.navLabel}
            primary={(
                <PageContainer role="main" aria-label={copy.mainLabel} measure="product">
                    <div data-state={state} className={SHARE_BODY_CLASS_NAME}>
                        <nav aria-label={copy.breadcrumbLabel} className={SHARE_BREADCRUMB_CLASS_NAME}>
                            <Link to="/tasks" appearance="inline" size="sm">{copy.destinations.tasks}</Link>
                            <span aria-hidden="true"><Text as="span" tone="muted" size="sm">/</Text></span>
                            {props.taskTitle === null ? null : (
                                <>
                                    <Link to="/tasks" appearance="inline" size="sm">{props.taskTitle}</Link>
                                    <span aria-hidden="true"><Text as="span" tone="muted" size="sm">/</Text></span>
                                </>
                            )}
                            <Text as="span" size="sm">{copy.breadcrumbSharing}</Text>
                        </nav>

                        <div>
                            <Heading level={1}>{copy.heading}</Heading>
                            {props.taskTitle === null ? null : <Text tone="muted">{props.taskTitle}</Text>}
                        </div>

                        <Link to="/tasks" appearance="inline">{copy.backToTask}</Link>

                        <SurfaceCard ariaLabel={copy.cardLabel}>
                            <Text weight="semibold">{copy.inviteHeading}</Text>
                            <Text tone="muted" size="sm">{copy.inviteTagline}</Text>
                            <form onSubmit={onInvite} noValidate className={SHARE_FORM_CLASS_NAME}>
                                <Input
                                    id="invite-email"
                                    name="email"
                                    label={copy.emailLabel}
                                    kind="email"
                                    value={props.email}
                                    onValueChange={props.onEmailChange}
                                    isRequired
                                    isDisabled={inviting}
                                    errorMessage={
                                        state === "refused" && props.refusalTarget === "email" && props.refusal !== null
                                            ? <Text as="span" live="assertive" size="sm">{props.refusal}</Text>
                                            : undefined
                                    }
                                />
                                <fieldset className={SHARE_FIELDSET_CLASS_NAME}>
                                    <legend><Text as="span" weight="medium" size="sm">{copy.roleLabel}</Text></legend>
                                    <label className={SHARE_RADIO_ROW_CLASS_NAME}>
                                        <input
                                            type="radio"
                                            name="invite-role"
                                            value="viewer"
                                            checked={props.role === "viewer"}
                                            disabled={inviting}
                                            onChange={() => props.onRoleChange("viewer")}
                                            className={SHARE_RADIO_INPUT_CLASS_NAME}
                                        />
                                        <Text as="span">{copy.roles.viewer}</Text>
                                    </label>
                                    <label className={SHARE_RADIO_ROW_CLASS_NAME}>
                                        <input
                                            type="radio"
                                            name="invite-role"
                                            value="editor"
                                            checked={props.role === "editor"}
                                            disabled={inviting}
                                            onChange={() => props.onRoleChange("editor")}
                                            className={SHARE_RADIO_INPUT_CLASS_NAME}
                                        />
                                        <Text as="span">{copy.roles.editor}</Text>
                                    </label>
                                    <Text tone="muted" size="sm">{copy.roleHint}</Text>
                                </fieldset>
                                <div>
                                    <Button type="submit" variant="primary" isDisabled={inviting} isPending={inviting}>
                                        {copy.sendInvitation}
                                    </Button>
                                </div>
                            </form>
                        </SurfaceCard>

                        {state === "refused" && props.refusalTarget === "form" && props.refusal !== null ? (
                            <Text live="assertive">{props.refusal}</Text>
                        ) : null}

                        {props.collaborators.length === 0 ? null : (
                            /* A collection of collaborators is a page section with a heading, never
                             * a card: SurfaceListCard's shell carries `starci-core-surface`, and a
                             * repeated-row list under that class is exactly what the canon render
                             * check refuses (entity-list-in-card - a card is one item). The plain
                             * labelled section is the same convention task-list's collection uses. */
                            <section aria-label={copy.collaborators} className={SHARE_COLLABORATOR_SECTION_CLASS_NAME}>
                                <Heading level={2}>{copy.collaborators}</Heading>
                                <div className={SHARE_COLLABORATOR_HEADER_CLASS_NAME}>
                                    <Text as="span" tone="muted" size="sm" weight="medium">{copy.columnPerson}</Text>
                                    <Text as="span" tone="muted" size="sm" weight="medium">{copy.columnAccess}</Text>
                                    <Text as="span" tone="muted" size="sm" weight="medium">{copy.columnStatus}</Text>
                                    <span aria-hidden="true" />
                                </div>
                                <ul className={SHARE_COLLABORATOR_ROWS_CLASS_NAME}>
                                    {props.collaborators.map(collaborator => (
                                        <li key={collaborator.id} className={SHARE_COLLABORATOR_ROW_CLASS_NAME}>
                                            <Text overflow="truncate">{collaborator.email}</Text>
                                            <Text>{copy.roles[collaborator.role]}</Text>
                                            <div><Badge tone="neutral">{copy.statuses[collaborator.status]}</Badge></div>
                                            {isRevocable(collaborator) ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    isPending={props.revokingId === collaborator.id}
                                                    isDisabled={props.revokingId !== null}
                                                    onPress={() => props.onRevoke(collaborator.id, collaborator.email)}
                                                >
                                                    {copy.revoke}
                                                </Button>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                                <Text tone="muted" size="sm">{copy.pendingExpiry}</Text>
                            </section>
                        )}

                        <footer className={SHARE_FOOTER_LINKS_CLASS_NAME}>
                            <Link to="/privacy-policy" appearance="inline" size="sm">{copy.legal.privacyPolicy}</Link>
                            <Link to="/terms" appearance="inline" size="sm">{copy.legal.terms}</Link>
                        </footer>
                    </div>
                </PageContainer>
            )}
        />
    )
}
