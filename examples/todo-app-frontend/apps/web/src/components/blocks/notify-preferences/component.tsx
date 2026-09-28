import { Button, GrammarRoot, Heading, PageContainer, SurfaceCard, Text, TextAction, WorkspaceShell } from "@starci/grammar/common"
import {
    ACCOUNT_CLUSTER_CLASS_NAME,
    ACTION_ROW_CLASS_NAME,
    AVATAR_CLASS_NAME,
    COMPACT_HEADER_CLASS_NAME,
    FOOTER_ROW_CLASS_NAME,
    HEADER_BAR_CLASS_NAME,
    HEADER_BRAND_NAV_CLASS_NAME,
    HEADER_NAV_LIST_CLASS_NAME,
    HEADER_ROW_CLASS_NAME,
    HEADING_GROUP_CLASS_NAME,
    PRIMARY_COLUMN_CLASS_NAME,
    RULE_CLASS_NAME,
    TOGGLE_ROW_CLASS_NAME,
    UNSUBSCRIBE_GROUP_CLASS_NAME,
} from "./classNames"

/** The closed ui.notify.preferences state vocabulary; the owner picks exactly one per render. */
export const NOTIFY_PREFERENCES_STATES = ["loading", "subscribed", "unsubscribed", "saving", "refused"] as const

/** One member of the ui.notify.preferences state vocabulary. */
export type NotifyPreferencesState = (typeof NOTIFY_PREFERENCES_STATES)[number];

/** Every word the pure preferences screen renders, resolved by the connected half. */
export type NotifyPreferencesViewCopy = {
  readonly brand: string;
  readonly accountName: string;
  readonly signOut: string;
  /** The accessible name of the destination row, in the header and in the compact band alike. */
  readonly navLabel: string;
  readonly destinations: {
    readonly tasks: string;
    readonly notifications: string;
    readonly plan: string;
    readonly privacy: string;
  };
  readonly legal: {
    readonly privacyPolicy: string;
    readonly terms: string;
  };
  readonly backToTasks: string;
  readonly breadcrumbLabel: string;
  /** The main landmark's accessible name. */
  readonly mainLabel: string;
  readonly breadcrumb: string;
  /** The screen title, which is also the digest card's accessible name. */
  readonly heading: string;
  readonly tagline: string;
  readonly digestHeading: string;
  readonly digestTagline: string;
  readonly on: string;
  readonly off: string;
  readonly turnOn: string;
  readonly turnOff: string;
  readonly unsubscribedNote: string;
  readonly save: string;
  readonly saving: string;
  readonly unsubscribe: string;
  readonly unsubscribeHint: string;
};

/** The view's complete contract: the resolved state, the displayed preference, the refusal
 * sentence when one applies, which write is pending, every word to draw, and the four user intents
 * plus sign out. */
export interface NotifyPreferencesViewProps {
  readonly state: NotifyPreferencesState;
  /** The preference the toggle currently shows - the saved value, or the unsaved draft once the
   * owner flips it. `null` means the value has not loaded yet, so the control rests as a skeleton. */
  readonly subscribed: boolean | null;
  /** The refusal sentence the owner settled on; rendered only while `state` is `refused`. */
  readonly refusal: string | null;
  /** Which write is in flight. `save` drives the save Button's busy label and pending; `unsubscribe`
   * marks the unsubscribe text action pending. Either one disables every write control. */
  readonly pending: "save" | "unsubscribe" | null;
  readonly copy: NotifyPreferencesViewCopy;
  readonly onToggle: () => void;
  readonly onSave: () => void;
  readonly onUnsubscribe: () => void;
  readonly onSignOut: () => void;
}

/** The four destinations' routes; their labels are copy and arrive through `props.copy`. */
const DESTINATIONS = [
    { key: "tasks", href: "/tasks" },
    { key: "notifications", href: "/notify/preferences" },
    { key: "plan", href: "/plan/usage" },
    { key: "privacy", href: "/privacy" },
] as const

/** The one destination this screen is. Compared by route, because labels are now translated. */
const CURRENT_DESTINATION_HREF = "/notify/preferences"

/** The route "Back to tasks" travels to; an inline href would bypass the navigation owner. */
const BACK_TO_TASKS_HREF = "/tasks"

/** The policy routes every signed-in screen's footer names. */
const FOOTER_LINKS = [
    { key: "privacyPolicy", href: "/privacy-policy" },
    { key: "terms", href: "/terms" },
] as const

interface DestinationNavProps {
  readonly copy: NotifyPreferencesViewCopy;
}

const DestinationNav = (props: DestinationNavProps) => (
    <nav aria-label={props.copy.navLabel} className={HEADER_NAV_LIST_CLASS_NAME}>
        {DESTINATIONS.map(destination => (
            <TextAction
                key={destination.key}
                appearance="tab"
                href={destination.href}
                isCurrent={destination.href === CURRENT_DESTINATION_HREF}
            >
                {props.copy.destinations[destination.key]}
            </TextAction>
        ))}
    </nav>
)

interface AccountPresenceProps {
  readonly copy: NotifyPreferencesViewCopy;
  readonly onSignOut: () => void;
}

const AccountPresence = (props: AccountPresenceProps) => (
    <div className={ACCOUNT_CLUSTER_CLASS_NAME}>
        <span aria-hidden="true" className={AVATAR_CLASS_NAME}>
      A
        </span>
        <Text>{props.copy.accountName}</Text>
        <TextAction appearance="inline" onPress={props.onSignOut}>
            {props.copy.signOut}
        </TextAction>
    </div>
)

/** The pure render of ui.notify.preferences; every one of its five states is decided by the
 * caller's `state` prop and stamped on the root as `data-state`. No hooks, no transport, no world
 * state. `mainLandmark: "caller"` keeps the shell's neutral primary div so the global
 * `main { max-width: 32rem }` rule in globals.css never caps the readable measure - the
 * role="main" div below owns the landmark instead. */
export const NotifyPreferencesView = (props: NotifyPreferencesViewProps) => {
    const copy = props.copy
    const { state, subscribed, refusal, pending } = props
    const busy = pending !== null

    return (
        <GrammarRoot data-state={state}>
            <WorkspaceShell
                mainLandmark="caller"
                header={
                    <div className={HEADER_BAR_CLASS_NAME}>
                        <PageContainer measure="product">
                            <div className={HEADER_ROW_CLASS_NAME}>
                                <div className={HEADER_BRAND_NAV_CLASS_NAME}>
                                    <Text weight="semibold">{copy.brand}</Text>
                                    <DestinationNav copy={copy} />
                                </div>
                                <AccountPresence copy={copy} onSignOut={props.onSignOut} />
                            </div>
                        </PageContainer>
                    </div>
                }
                compactHeader={
                    <div className={COMPACT_HEADER_CLASS_NAME}>
                        <Text weight="semibold">{copy.brand}</Text>
                        <AccountPresence copy={copy} onSignOut={props.onSignOut} />
                    </div>
                }
                compactNavigation={
                    <>
                        {DESTINATIONS.map(destination => (
                            <TextAction
                                key={destination.key}
                                appearance="tab"
                                href={destination.href}
                                isCurrent={destination.href === CURRENT_DESTINATION_HREF}
                            >
                                {copy.destinations[destination.key]}
                            </TextAction>
                        ))}
                    </>
                }
                compactNavigationLabel={copy.navLabel}
                primary={
                    <div role="main" aria-label={copy.mainLabel}>
                        <PageContainer measure="product">
                            <div className={PRIMARY_COLUMN_CLASS_NAME}>
                                <nav aria-label={copy.breadcrumbLabel}>
                                    <Text size="sm" tone="muted">
                                        {copy.breadcrumb}
                                    </Text>
                                </nav>
                                <div className={HEADING_GROUP_CLASS_NAME}>
                                    <Heading level={1}>{copy.heading}</Heading>
                                    <Text tone="muted">{copy.tagline}</Text>
                                </div>
                                <SurfaceCard ariaLabel={copy.heading}>
                                    <Heading level={2}>{copy.digestHeading}</Heading>
                                    <Text tone="muted">{copy.digestTagline}</Text>
                                    {state === "refused" && refusal !== null ? <Text live="assertive">{refusal}</Text> : null}
                                    <div className={TOGGLE_ROW_CLASS_NAME}>
                                        <Text weight="medium" isSkeleton={subscribed === null}>
                                            {subscribed === false ? copy.off : copy.on}
                                        </Text>
                                        <Button
                                            variant={subscribed === false ? "secondary" : "primary"}
                                            isDisabled={subscribed === null || busy}
                                            isSkeleton={subscribed === null}
                                            onPress={props.onToggle}
                                        >
                                            {subscribed === false ? copy.turnOn : copy.turnOff}
                                        </Button>
                                    </div>
                                    {state === "unsubscribed" ? (
                                        <Text live="polite">{copy.unsubscribedNote}</Text>
                                    ) : null}
                                </SurfaceCard>
                                <div className={ACTION_ROW_CLASS_NAME}>
                                    <Button
                                        variant="primary"
                                        isDisabled={subscribed === null || busy}
                                        isPending={pending === "save"}
                                        onPress={props.onSave}
                                    >
                                        {pending === "save" ? copy.saving : copy.save}
                                    </Button>
                                    <TextAction appearance="inline" href={BACK_TO_TASKS_HREF}>
                                        {copy.backToTasks}
                                    </TextAction>
                                </div>
                                <div aria-hidden="true" className={RULE_CLASS_NAME} />
                                <div className={UNSUBSCRIBE_GROUP_CLASS_NAME}>
                                    <TextAction
                                        appearance="inline"
                                        isDisabled={busy}
                                        isPending={pending === "unsubscribe"}
                                        onPress={props.onUnsubscribe}
                                    >
                                        {copy.unsubscribe}
                                    </TextAction>
                                    <Text size="sm" tone="muted">
                                        {copy.unsubscribeHint}
                                    </Text>
                                </div>
                                <footer className={FOOTER_ROW_CLASS_NAME}>
                                    {FOOTER_LINKS.map(link => (
                                        <TextAction key={link.key} appearance="inline" href={link.href}>
                                            {copy.legal[link.key]}
                                        </TextAction>
                                    ))}
                                </footer>
                            </div>
                        </PageContainer>
                    </div>
                }
            />
        </GrammarRoot>
    )
}
