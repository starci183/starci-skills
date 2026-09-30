import {
    Badge,
    Button,
    Form,
    GrammarRoot,
    Heading,
    Input,
    RadioGroup,
    SurfaceCard,
    Text,
    TextAction,
    type BreadcrumbItem,
} from "@starci/grammar/common"
import { AccountShell, type AccountShellCopy } from "@/components/composites/AccountShell"
import { ROUTES } from "@/modules/routes"
import type { Collaborator, ShareRole } from "@/modules/types"
import {
    SHARE_COLLABORATOR_HEADER_CLASS_NAME,
    SHARE_COLLABORATOR_ROW_CLASS_NAME,
    SHARE_COLLABORATOR_ROWS_CLASS_NAME,
    SHARE_COLLABORATOR_SECTION_CLASS_NAME,
    SHARE_FORM_CLASS_NAME,
} from "./classNames"

/**
 * ui.share.invite states: empty, inviting, pending-list, accepted, refused. A state this record does
 * not name has no branch here. The connected owner in ./index.tsx resolves which state applies and
 * hands it down explicitly; this view never re-derives it from the query or mutation results.
 */
export type ShareInviteState = "empty" | "inviting" | "pending-list" | "accepted" | "refused"

/** The one beside-it inventory the ShareInviteState closed vocabulary is checked against. */
export const SHARE_INVITE_STATES: ReadonlyArray<ShareInviteState> = [
    "empty",
    "inviting",
    "pending-list",
    "accepted",
    "refused",
] as const

/** Every word the pure invitation screen renders, resolved by the connected half. */
export type ShareInviteViewCopy = AccountShellCopy & {
    readonly backToTask: string
    readonly heading: string
    readonly cardLabel: string
    readonly inviteHeading: string
    readonly inviteTagline: string
    readonly emailLabel: string
    readonly roleLabel: string
    /** The invitation's two roles, keyed by the wire value. */
    readonly roles: {
        readonly viewer: string
        readonly editor: string
    }
    readonly roleHint: string
    readonly sendInvitation: string
    readonly collaborators: string
    readonly pendingExpiry: string
    readonly columnPerson: string
    readonly columnAccess: string
    readonly columnStatus: string
    /** The invitation lifecycle's four states, keyed by the wire value. */
    readonly statuses: {
        readonly pending: string
        readonly accepted: string
        readonly expired: string
        readonly revoked: string
    }
    readonly revoke: string
}

/** The public props of the pure invitation-screen view. */
export type ShareInviteViewProps = {
    readonly state: ShareInviteState
    readonly collaborators: ReadonlyArray<Collaborator>
    readonly taskTitle: string | null
    readonly refusal: string | null
    /** Where the refused submission's assertive sentence belongs: on the email field, or on the form. */
    readonly refusalTarget: "email" | "form"
    readonly email: string
    readonly role: ShareRole
    readonly revokingId: string | null
    readonly copy: ShareInviteViewCopy
    readonly onEmailChange: (value: string) => void
    readonly onRoleChange: (role: ShareRole) => void
    readonly onInvite: () => void
    readonly onRevoke: (invitationId: string, email: string) => void
    readonly onSignOut: () => void
}

/** fr.share.revoke: only a live (pending or accepted) invitation can still be revoked. */
const isRevocable = (collaborator: Collaborator): boolean =>
    collaborator.status === "pending" || collaborator.status === "accepted"

/** The pure render of ui.share.invite; every one of its five states is decided by the caller's
 * `state`, and every word it draws arrives resolved through `copy`. */
export const ShareInviteView = (props: ShareInviteViewProps) => {
    const copy = props.copy
    const state = props.state
    const inviting = state === "inviting"
    const roleOptions = [
        { value: "viewer", label: copy.roles.viewer },
        { value: "editor", label: copy.roles.editor },
    ]
    const trail: ReadonlyArray<BreadcrumbItem> = [
        { id: "tasks", label: copy.destinations.tasks, href: ROUTES.tasks },
        ...(props.taskTitle === null ? [] : [{ id: "task", label: props.taskTitle, href: ROUTES.tasks }]),
        { id: "sharing", label: copy.breadcrumb },
    ]
    const onRoleChange = (value: string) => {
        if (value === "viewer" || value === "editor") props.onRoleChange(value)
    }

    return (
        <GrammarRoot data-state={state}>
            <AccountShell copy={copy} currentHref={ROUTES.tasks} onSignOut={props.onSignOut} trail={trail}>
                <div>
                    <Heading level={1}>{copy.heading}</Heading>
                    {props.taskTitle === null ? null : <Text tone="muted">{props.taskTitle}</Text>}
                </div>

                <TextAction appearance="inline" href={ROUTES.tasks}>
                    {copy.backToTask}
                </TextAction>

                <SurfaceCard ariaLabel={copy.cardLabel}>
                    <Text weight="semibold">{copy.inviteHeading}</Text>
                    <Text tone="muted" size="sm">
                        {copy.inviteTagline}
                    </Text>
                    <Form label={copy.cardLabel} onSubmit={props.onInvite} isPending={inviting}>
                        <div className={SHARE_FORM_CLASS_NAME}>
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
                                    state === "refused" && props.refusalTarget === "email" && props.refusal !== null ? (
                                        <Text as="span" live="assertive" size="sm">
                                            {props.refusal}
                                        </Text>
                                    ) : undefined
                                }
                            />
                            <RadioGroup
                                name="invite-role"
                                label={copy.roleLabel}
                                description={copy.roleHint}
                                options={roleOptions}
                                value={props.role}
                                onValueChange={onRoleChange}
                                isDisabled={inviting}
                            />
                            <div>
                                <Button type="submit" variant="primary" isDisabled={inviting} isPending={inviting}>
                                    {copy.sendInvitation}
                                </Button>
                            </div>
                        </div>
                    </Form>
                </SurfaceCard>

                {state === "refused" && props.refusalTarget === "form" && props.refusal !== null ? (
                    <Text live="assertive">{props.refusal}</Text>
                ) : null}

                {props.collaborators.length === 0 ? null : (
                    /* A collection of collaborators is a page section with a heading, never a card:
                     * a repeated-row list under a card surface is exactly what the canon render
                     * check refuses (entity-list-in-card - a card is one item). */
                    <div
                        role="region"
                        aria-label={copy.collaborators}
                        className={SHARE_COLLABORATOR_SECTION_CLASS_NAME}
                    >
                        <Heading level={2}>{copy.collaborators}</Heading>
                        <div className={SHARE_COLLABORATOR_HEADER_CLASS_NAME}>
                            <Text as="span" tone="muted" size="sm" weight="medium">
                                {copy.columnPerson}
                            </Text>
                            <Text as="span" tone="muted" size="sm" weight="medium">
                                {copy.columnAccess}
                            </Text>
                            <Text as="span" tone="muted" size="sm" weight="medium">
                                {copy.columnStatus}
                            </Text>
                            <div aria-hidden="true" />
                        </div>
                        <div role="list" className={SHARE_COLLABORATOR_ROWS_CLASS_NAME}>
                            {props.collaborators.map((collaborator) => (
                                <div
                                    key={collaborator.id}
                                    role="listitem"
                                    className={SHARE_COLLABORATOR_ROW_CLASS_NAME}
                                >
                                    <Text overflow="truncate">{collaborator.email}</Text>
                                    <Text>{copy.roles[collaborator.role]}</Text>
                                    <div>
                                        <Badge tone="neutral">{copy.statuses[collaborator.status]}</Badge>
                                    </div>
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
                                </div>
                            ))}
                        </div>
                        <Text tone="muted" size="sm">
                            {copy.pendingExpiry}
                        </Text>
                    </div>
                )}
            </AccountShell>
        </GrammarRoot>
    )
}
