import { Button, GrammarRoot, Heading, SurfaceCard, Text, TextAction, WorkspaceShell } from "@starci/grammar/common"
import {
    ACTION_ROW_CLASS_NAME,
    AVATAR_CLASS_NAME,
    COMPACT_ACCOUNT_CLASS_NAME,
    COMPACT_HEADER_CLASS_NAME,
    CONFIRM_ROW_CLASS_NAME,
    FACE_CLASS_NAME,
    FOOTER_ROW_CLASS_NAME,
    HEADER_ACCOUNT_CLASS_NAME,
    HEADER_BAR_CLASS_NAME,
    HEADER_BRAND_NAV_CLASS_NAME,
    HEADER_NAV_LIST_CLASS_NAME,
    HEADER_ROW_CLASS_NAME,
    PRIMARY_COLUMN_CLASS_NAME,
    RULE_CLASS_NAME,
} from "./classNames"

/**
 * The pure render of ui.audit.privacy; every one of its six states is decided by the caller's
 * `state` prop and stamped on the root as `data-state`. No hooks, no transport, no world state.
 */

export const PRIVACY_STATES = [
    "idle",
    "exporting",
    "requesting-erasure",
    "erasure-pending",
    "erasure-complete",
    "erasure-refused",
] as const

/** The closed ui.audit.privacy state vocabulary; the owner picks exactly one per render. */
export type PrivacyState = (typeof PRIVACY_STATES)[number];

/** Every word the pure privacy screen renders, resolved by the connected half. */
export type PrivacyViewCopy = {
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
  readonly heading: string;
  readonly tagline: string;
  /** The joined card's accessible name; the two sections inside name themselves. */
  readonly cardLabel: string;
  readonly exportHeading: string;
  readonly exportTagline: string;
  readonly exportAction: string;
  readonly exporting: string;
  readonly erasureHeading: string;
  readonly erasureTagline: string;
  readonly erasureAction: string;
  readonly erasureConfirm: string;
  readonly erasureCancel: string;
  readonly erasurePending: string;
  readonly erasureComplete: string;
};

/** The view's complete contract: one state, the refusal sentences, every word to draw, and the six
 * user intents. */
export interface PrivacyViewProps {
  readonly state: PrivacyState;
  /** The refusal sentence the owner derived from the real failure; rendered only in erasure-refused. */
  readonly refusal: string | null;
  /** A failed export's own sentence; the export section reports it without leaving the idle state. */
  readonly exportRefusal: string | null;
  readonly copy: PrivacyViewCopy;
  readonly onExport: () => void;
  readonly onRequestErasure: () => void;
  readonly onConfirmErasure: () => void;
  readonly onCancelErasure: () => void;
  readonly onSignOut: () => void;
}

/** The four destinations' routes and the footer pair; their labels are copy. */
const DESTINATIONS = [
    { key: "tasks", href: "/tasks" },
    { key: "notifications", href: "/notify/preferences" },
    { key: "plan", href: "/plan/usage" },
    { key: "privacy", href: "/privacy" },
] as const

/** The one destination this screen is. Compared by route, because labels are now translated. */
const CURRENT_DESTINATION_HREF = "/privacy"

/** The route "Back to tasks" travels to; an inline href would bypass the navigation owner. */
const BACK_TO_TASKS_HREF = "/tasks"

const FOOTER_LINKS = [
    { key: "privacyPolicy", href: "/privacy-policy" },
    { key: "terms", href: "/terms" },
] as const

interface DestinationNavProps {
  readonly copy: PrivacyViewCopy;
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
  readonly copy: PrivacyViewCopy;
  readonly onSignOut: () => void;
}

const AccountPresence = (props: AccountPresenceProps) => (
    <div className={HEADER_ACCOUNT_CLASS_NAME}>
        <span aria-hidden="true" className={AVATAR_CLASS_NAME}>
      A
        </span>
        <Text>{props.copy.accountName}</Text>
        <TextAction appearance="inline" onPress={props.onSignOut}>
            {props.copy.signOut}
        </TextAction>
    </div>
)

/** Pure view for the privacy screen: renders the workspace shell and every mapped privacy state. */
export const PrivacyView = (props: PrivacyViewProps) => {
    const copy = props.copy
    const { state, refusal, exportRefusal } = props
    const erasureBusy = state === "erasure-pending"
    const complete = state === "erasure-complete"

    return (
        <GrammarRoot data-state={state}>
            <WorkspaceShell
                mainLandmark="caller"
                header={
                    <div className={HEADER_BAR_CLASS_NAME}>
                        <div className={HEADER_ROW_CLASS_NAME}>
                            <div className={HEADER_BRAND_NAV_CLASS_NAME}>
                                <Text weight="semibold">{copy.brand}</Text>
                                <DestinationNav copy={copy} />
                            </div>
                            <AccountPresence copy={copy} onSignOut={props.onSignOut} />
                        </div>
                    </div>
                }
                compactHeader={
                    <div className={COMPACT_HEADER_CLASS_NAME}>
                        <Text weight="semibold">{copy.brand}</Text>
                        <div className={COMPACT_ACCOUNT_CLASS_NAME}>
                            <span aria-hidden="true" className={AVATAR_CLASS_NAME}>
                A
                            </span>
                            <Text>{copy.accountName}</Text>
                            <TextAction appearance="inline" onPress={props.onSignOut}>
                                {copy.signOut}
                            </TextAction>
                        </div>
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
                    <div aria-label={copy.mainLabel} className={PRIMARY_COLUMN_CLASS_NAME} role="main">
                        <nav aria-label={copy.breadcrumbLabel}>
                            <Text size="sm" tone="muted">
                                {copy.breadcrumb}
                            </Text>
                        </nav>
                        <div>
                            <Heading level={1} scale="display">{copy.heading}</Heading>
                            <Text tone="muted">{copy.tagline}</Text>
                        </div>
                        <SurfaceCard ariaLabel={copy.cardLabel} composition="joined" frame="frameless">
                            <section aria-label={copy.exportHeading} className={FACE_CLASS_NAME}>
                                <Heading level={2}>{copy.exportHeading}</Heading>
                                <Text tone="muted">{copy.exportTagline}</Text>
                                {complete ? null : (
                                    <div className={ACTION_ROW_CLASS_NAME}>
                                        <Button
                                            isDisabled={erasureBusy}
                                            isPending={state === "exporting"}
                                            onPress={props.onExport}
                                            variant="secondary"
                                        >
                                            {state === "exporting" ? copy.exporting : copy.exportAction}
                                        </Button>
                                    </div>
                                )}
                                {exportRefusal === null ? null : (
                                    <Text live="assertive">{exportRefusal}</Text>
                                )}
                            </section>
                            <div aria-hidden="true" className={RULE_CLASS_NAME} />
                            <section aria-label={copy.erasureHeading} className={FACE_CLASS_NAME}>
                                <Heading level={2}>{copy.erasureHeading}</Heading>
                                <Text tone="muted">
                                    {copy.erasureTagline}
                                </Text>
                                {state === "erasure-refused" && refusal !== null ? (
                                    <Text live="assertive">{refusal}</Text>
                                ) : null}
                                {complete ? (
                                    <Text live="polite">
                                        {copy.erasureComplete}
                                    </Text>
                                ) : state === "requesting-erasure" ? (
                                    <div className={CONFIRM_ROW_CLASS_NAME}>
                                        <Button onPress={props.onConfirmErasure} variant="outline">
                                            {copy.erasureConfirm}
                                        </Button>
                                        <Button onPress={props.onCancelErasure} variant="ghost">
                                            {copy.erasureCancel}
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        {erasureBusy ? (
                                            <Text live="polite" tone="muted">
                                                {copy.erasurePending}
                                            </Text>
                                        ) : null}
                                        <div className={ACTION_ROW_CLASS_NAME}>
                                            <Button
                                                isDisabled={erasureBusy}
                                                onPress={props.onRequestErasure}
                                                variant="outline"
                                            >
                                                {copy.erasureAction}
                                            </Button>
                                            <TextAction appearance="inline" href={BACK_TO_TASKS_HREF}>
                                                {copy.backToTasks}
                                            </TextAction>
                                        </div>
                                    </>
                                )}
                            </section>
                        </SurfaceCard>
                        <div aria-hidden="true" className={RULE_CLASS_NAME} />
                        <footer className={FOOTER_ROW_CLASS_NAME}>
                            {FOOTER_LINKS.map(link => (
                                <TextAction key={link.key} appearance="inline" href={link.href}>
                                    {copy.legal[link.key]}
                                </TextAction>
                            ))}
                        </footer>
                    </div>
                }
            />
        </GrammarRoot>
    )
}
