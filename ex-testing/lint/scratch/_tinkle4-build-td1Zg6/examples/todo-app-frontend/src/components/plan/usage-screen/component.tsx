import { Button, GrammarRoot, Heading, PageContainer, Progress, SurfaceCard, Text, WorkspaceShell } from "@starci/grammar/common"
import { PlanRoutedAction } from "../routed-action"
import {
    PLAN_ACCOUNT_CLASS_NAME,
    PLAN_ACTIONS_CLASS_NAME,
    PLAN_AVATAR_CLASS_NAME,
    PLAN_COMPACT_HEADER_CLASS_NAME,
    PLAN_COMPACT_NAV_CLASS_NAME,
    PLAN_FOOTER_CLASS_NAME,
    PLAN_HEADER_CLASS_NAME,
    PLAN_HEADER_NAV_CLASS_NAME,
    PLAN_PRIMARY_CLASS_NAME,
    PLAN_PROGRESS_ROW_CLASS_NAME,
    PLAN_PROGRESS_TRACK_CLASS_NAME,
    PLAN_THEME_SCOPE_CLASS_NAME,
    PLAN_USAGE_BODY_CLASS_NAME,
} from "./classNames"

/**
 * ui.plan.usage states: under-cap, at-cap, over-cap-frozen and paid-unlimited are the four the record
 * names; loading and refused are the two data-lifecycle states the planUsage read itself owns. The
 * connected owner in ./index.tsx resolves which state applies from the API result and hands it down
 * explicitly; this view never re-derives it.
 */
export type UsageScreenViewState = "loading" | "refused" | "under-cap" | "at-cap" | "over-cap-frozen" | "paid-unlimited";

/** The one beside-it inventory the UsageScreenViewState closed vocabulary is checked against. */
export const USAGE_SCREEN_VIEW_STATES: ReadonlyArray<UsageScreenViewState> = ["loading", "refused", "under-cap", "at-cap", "over-cap-frozen", "paid-unlimited"] as const

/** The four destinations' routes and the footer pair; their labels are copy. */
const DESTINATIONS = [
    { key: "tasks", href: "/tasks" },
    { key: "notifications", href: "/notify/preferences" },
    { key: "plan", href: "/plan/usage" },
    { key: "privacy", href: "/privacy" },
] as const

const FOOTER_DESTINATIONS = [
    { key: "privacyPolicy", href: "/privacy-policy" },
    { key: "terms", href: "/terms" },
] as const

/** Every word the pure plan usage view renders, resolved by the connected half. The formatters carry
 * the numbers only this screen holds: the count, the cap, and the share of it in use. */
export type UsageScreenViewCopy = {
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
  /** The main landmark's accessible name. */
  readonly mainLabel: string;
  readonly breadcrumb: string;
  readonly heading: string;
  readonly usageCard: string;
  readonly freePlan: string;
  readonly paidPlan: string;
  readonly formatActiveTasks: (count: number) => string;
  readonly formatFreePlanLimit: (cap: number) => string;
  readonly progressLabel: string;
  readonly formatPercentOfCap: (percent: number) => string;
  readonly formatAtCap: (cap: number) => string;
  readonly formatOverCapCount: (count: number, cap: number) => string;
  readonly formatOverCapPaused: (cap: number) => string;
  readonly overCapNote: string;
  readonly upgrade: string;
  readonly manageTasks: string;
  readonly completeFreesSpace: string;
};

/** The public props of the pure plan usage view. */
export type UsageScreenViewProps = {
  readonly state: UsageScreenViewState;
  readonly plan: string | null;
  readonly activeCount: number;
  readonly cap: number | null;
  readonly readRefusal: string | null;
  readonly upgradeRefusal: string | null;
  readonly isUpgrading: boolean;
  readonly copy: UsageScreenViewCopy;
  readonly onUpgrade: () => void;
  readonly onSignOut: () => void;
};

const destinationActions = (copy: UsageScreenViewCopy, current: string) => DESTINATIONS.map(destination => (
    <PlanRoutedAction
        key={destination.href}
        appearance="tab"
        route={destination.href}
        isCurrent={destination.href === current}
    >
        {copy.destinations[destination.key]}
    </PlanRoutedAction>
))

/** The pure render of ui.plan.usage: the workspace shell, the usage card and every named state. */
export const UsageScreenView = (props: UsageScreenViewProps) => {
    const copy = props.copy
    const state = props.state
    const percentOfCap = props.cap !== null && props.cap > 0 ? Math.round((props.activeCount / props.cap) * 100) : 0
    const activeTasks = copy.formatActiveTasks(props.activeCount)
    /* The two cap sentences name a number this screen only holds when a cap exists; the connected
   * half resolves at-cap and over-cap-frozen from a non-null cap, so the null branch is a type
   * obligation rather than a state a reader can reach. */
    const atCapSentence = props.cap === null ? null : copy.formatAtCap(props.cap)
    const overCapCountSentence = props.cap === null ? null : copy.formatOverCapCount(props.activeCount, props.cap)
    const overCapPausedSentence = props.cap === null ? null : copy.formatOverCapPaused(props.cap)

    const header = (
        <div className={PLAN_HEADER_CLASS_NAME}>
            <Text weight="semibold" size="md">{copy.brand}</Text>
            <nav aria-label={copy.navLabel} className={PLAN_HEADER_NAV_CLASS_NAME}>
                {destinationActions(copy, "/plan/usage")}
            </nav>
            <div className={PLAN_ACCOUNT_CLASS_NAME}>
                <span aria-hidden="true" className={PLAN_AVATAR_CLASS_NAME}>A</span>
                <Text>{copy.accountName}</Text>
                <PlanRoutedAction appearance="inline" route="/sign-in" onFollow={props.onSignOut}>{copy.signOut}</PlanRoutedAction>
            </div>
        </div>
    )

    const compactHeader = (
        <div className={PLAN_COMPACT_HEADER_CLASS_NAME}>
            <Text weight="semibold" size="md">{copy.brand}</Text>
            <div className={PLAN_ACCOUNT_CLASS_NAME}>
                <Text>{copy.accountName}</Text>
                <PlanRoutedAction appearance="inline" route="/sign-in" onFollow={props.onSignOut}>{copy.signOut}</PlanRoutedAction>
            </div>
        </div>
    )

    const compactNavigation = (
        <div className={PLAN_COMPACT_NAV_CLASS_NAME}>
            {destinationActions(copy, "/plan/usage")}
        </div>
    )

    return (
        <GrammarRoot className={PLAN_THEME_SCOPE_CLASS_NAME}>
            <WorkspaceShell
                primaryLabel={copy.mainLabel}
                header={header}
                compactHeader={compactHeader}
                compactNavigation={compactNavigation}
                compactNavigationLabel={copy.navLabel}
                primary={(
                    <PageContainer measure="product" className={PLAN_PRIMARY_CLASS_NAME}>
                        <Text tone="muted" size="sm">{copy.breadcrumb}</Text>
                        <Heading level={1} scale="display">{copy.heading}</Heading>
                        <SurfaceCard ariaLabel={copy.usageCard}>
                            <div data-state={state} className={PLAN_USAGE_BODY_CLASS_NAME}>
                                {state === "loading" ? (
                                    <>
                                        <Text isSkeleton>{copy.freePlan}</Text>
                                        <Text size="metric-lead" weight="semibold" isSkeleton>{activeTasks}</Text>
                                        <Progress label={copy.progressLabel} isSkeleton />
                                    </>
                                ) : null}
                                {state === "refused" ? (
                                    <Text live="assertive">{props.readRefusal}</Text>
                                ) : null}
                                {state !== "loading" && state !== "refused" ? (
                                    <>
                                        <Text tone="muted">{props.plan === "paid" ? copy.paidPlan : copy.freePlan}</Text>
                                        <Text size="metric-lead" weight="semibold">{activeTasks}</Text>
                                        {state !== "paid-unlimited" && props.cap !== null ? (
                                            <>
                                                <Text tone="muted">{copy.formatFreePlanLimit(props.cap)}</Text>
                                                <div className={PLAN_PROGRESS_ROW_CLASS_NAME}>
                                                    <div className={PLAN_PROGRESS_TRACK_CLASS_NAME}>
                                                        <Progress label={copy.progressLabel} value={Math.min(100, percentOfCap)} />
                                                    </div>
                                                    <Text>{copy.formatPercentOfCap(percentOfCap)}</Text>
                                                </div>
                                            </>
                                        ) : null}
                                        {state === "at-cap" ? (
                                            <>
                                                <Text live="polite">
                                                    {atCapSentence}
                                                </Text>
                                                <div className={PLAN_ACTIONS_CLASS_NAME}>
                                                    <Button variant="secondary" onPress={props.onUpgrade} isPending={props.isUpgrading}>
                                                        {copy.upgrade}
                                                    </Button>
                                                </div>
                                            </>
                                        ) : null}
                                        {state === "over-cap-frozen" ? (
                                            <>
                                                <Text live="assertive">
                                                    {overCapCountSentence}
                                                </Text>
                                                <Text weight="semibold">{overCapPausedSentence}</Text>
                                                <Text>{copy.overCapNote}</Text>
                                                <div className={PLAN_ACTIONS_CLASS_NAME}>
                                                    <Button variant="primary" onPress={props.onUpgrade} isPending={props.isUpgrading}>
                                                        {copy.upgrade}
                                                    </Button>
                                                    <PlanRoutedAction appearance="inline" route="/tasks">{copy.manageTasks}</PlanRoutedAction>
                                                </div>
                                                <Text tone="muted">{copy.completeFreesSpace}</Text>
                                            </>
                                        ) : null}
                                        {props.upgradeRefusal !== null ? (
                                            <Text live="assertive">{props.upgradeRefusal}</Text>
                                        ) : null}
                                    </>
                                ) : null}
                            </div>
                        </SurfaceCard>
                        <footer className={PLAN_FOOTER_CLASS_NAME}>
                            {FOOTER_DESTINATIONS.map(destination => (
                                <PlanRoutedAction key={destination.href} appearance="inline" route={destination.href}>
                                    {copy.legal[destination.key]}
                                </PlanRoutedAction>
                            ))}
                        </footer>
                    </PageContainer>
                )}
            />
        </GrammarRoot>
    )
}
