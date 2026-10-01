import { Button, GrammarRoot, Heading, Progress, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { AccountShell, type AccountShellCopy } from "@/components/composites/AccountShell"
import { ROUTES } from "@/modules/routes"
import {
    PLAN_ACTIONS_CLASS_NAME,
    PLAN_PROGRESS_ROW_CLASS_NAME,
    PLAN_PROGRESS_TRACK_CLASS_NAME,
    PLAN_USAGE_BODY_CLASS_NAME,
} from "./classNames"

/**
 * ui.plan.usage states: under-cap, at-cap, over-cap-frozen and paid-unlimited are the four the record
 * names; loading and refused are the two data-lifecycle states the planUsage read itself owns. The
 * connected owner in ./index.tsx resolves which state applies from the API result and hands it down
 * explicitly; this view never re-derives it.
 */
export type UsageScreenViewState = "loading" | "refused" | "under-cap" | "at-cap" | "over-cap-frozen" | "paid-unlimited"

/** The one beside-it inventory the UsageScreenViewState closed vocabulary is checked against. */
export const USAGE_SCREEN_VIEW_STATES: ReadonlyArray<UsageScreenViewState> = [
    "loading",
    "refused",
    "under-cap",
    "at-cap",
    "over-cap-frozen",
    "paid-unlimited",
] as const

/** Every word the pure plan usage view renders, resolved by the connected half. The formatters carry
 * the numbers only this screen holds: the count, the cap, and the share of it in use. */
export type UsageScreenViewCopy = AccountShellCopy & {
    readonly heading: string
    readonly usageCard: string
    readonly freePlan: string
    readonly paidPlan: string
    readonly formatActiveTasks: (count: number) => string
    readonly formatFreePlanLimit: (cap: number) => string
    readonly progressLabel: string
    readonly formatPercentOfCap: (percent: number) => string
    readonly formatAtCap: (cap: number) => string
    readonly formatOverCapCount: (count: number, cap: number) => string
    readonly formatOverCapPaused: (cap: number) => string
    readonly overCapNote: string
    readonly upgrade: string
    readonly manageTasks: string
    readonly completeFreesSpace: string
}

/** The public props of the pure plan usage view. */
export type UsageScreenViewProps = {
    readonly state: UsageScreenViewState
    readonly plan: string | null
    readonly activeCount: number
    readonly cap: number | null
    readonly readRefusal: string | null
    readonly upgradeRefusal: string | null
    readonly isUpgrading: boolean
    readonly copy: UsageScreenViewCopy
    readonly onUpgrade: () => void
    readonly onSignOut: () => void
}

/** The share of the cap in use, in whole percent; zero when there is no positive cap to measure against. */
const percentOfCapOf = (activeCount: number, cap: number | null): number => {
    if (cap === null || cap <= 0) return 0
    return Math.round((activeCount / cap) * 100)
}

/** The three cap sentences, each naming the reader's own numbers. */
type CapSentences = {
    readonly atCap: string | null
    readonly overCapCount: string | null
    readonly overCapPaused: string | null
}

/**
 * The cap sentences name a number this screen only holds when a cap exists; the connected half
 * resolves at-cap and over-cap-frozen from a non-null cap, so the null branch is a type obligation
 * rather than a state a reader can reach.
 */
const capSentencesOf = (copy: UsageScreenViewCopy, activeCount: number, cap: number | null): CapSentences => {
    if (cap === null) return { atCap: null, overCapCount: null, overCapPaused: null }
    return {
        atCap: copy.formatAtCap(cap),
        overCapCount: copy.formatOverCapCount(activeCount, cap),
        overCapPaused: copy.formatOverCapPaused(cap),
    }
}

/** The pure render of ui.plan.usage: the workspace shell, the usage card and every named state. */
export const UsageScreenView = (props: UsageScreenViewProps) => {
    const copy = props.copy
    const state = props.state
    const percentOfCap = percentOfCapOf(props.activeCount, props.cap)
    const activeTasks = copy.formatActiveTasks(props.activeCount)
    const capSentences = capSentencesOf(copy, props.activeCount, props.cap)

    return (
        <GrammarRoot>
            <AccountShell copy={copy} currentHref={ROUTES.planUsage} onSignOut={props.onSignOut}>
                <Heading level={1} scale="display">
                    {copy.heading}
                </Heading>
                <SurfaceCard ariaLabel={copy.usageCard}>
                    <div data-state={state} className={PLAN_USAGE_BODY_CLASS_NAME}>
                        {state === "loading" ? (
                            <>
                                <div>
                                    <Text isSkeleton>{copy.freePlan}</Text>
                                </div>
                                <div>
                                    <Text size="metric-lead" weight="semibold" isSkeleton>
                                        {activeTasks}
                                    </Text>
                                </div>
                                <div>
                                    <Progress label={copy.progressLabel} isSkeleton />
                                </div>
                            </>
                        ) : null}
                        {state === "refused" ? <Text live="assertive">{props.readRefusal}</Text> : null}
                        {state !== "loading" && state !== "refused" ? (
                            /* Every stat is its own row: three or more sibling Text atoms inside the
                             * card read as an entity list in a card surface to the canon render
                             * check (COLLECTION-1/2), which a card - one item - may not hold. */
                            <>
                                <div>
                                    <Text tone="muted">{props.plan === "paid" ? copy.paidPlan : copy.freePlan}</Text>
                                </div>
                                <div>
                                    <Text size="metric-lead" weight="semibold">
                                        {activeTasks}
                                    </Text>
                                </div>
                                {state !== "paid-unlimited" && props.cap !== null ? (
                                    <>
                                        <div>
                                            <Text tone="muted">{copy.formatFreePlanLimit(props.cap)}</Text>
                                        </div>
                                        <div className={PLAN_PROGRESS_ROW_CLASS_NAME}>
                                            <div className={PLAN_PROGRESS_TRACK_CLASS_NAME}>
                                                <Progress
                                                    label={copy.progressLabel}
                                                    value={Math.min(100, percentOfCap)}
                                                />
                                            </div>
                                            <Text>{copy.formatPercentOfCap(percentOfCap)}</Text>
                                        </div>
                                    </>
                                ) : null}
                                {state === "at-cap" ? (
                                    <>
                                        <div>
                                            <Text live="polite">{capSentences.atCap}</Text>
                                        </div>
                                        <div className={PLAN_ACTIONS_CLASS_NAME}>
                                            <Button
                                                variant="secondary"
                                                onPress={props.onUpgrade}
                                                isPending={props.isUpgrading}
                                            >
                                                {copy.upgrade}
                                            </Button>
                                        </div>
                                    </>
                                ) : null}
                                {state === "over-cap-frozen" ? (
                                    <>
                                        <div>
                                            <Text live="assertive">{capSentences.overCapCount}</Text>
                                        </div>
                                        <div>
                                            <Text weight="semibold">{capSentences.overCapPaused}</Text>
                                        </div>
                                        <div>
                                            <Text>{copy.overCapNote}</Text>
                                        </div>
                                        <div className={PLAN_ACTIONS_CLASS_NAME}>
                                            <Button
                                                variant="primary"
                                                onPress={props.onUpgrade}
                                                isPending={props.isUpgrading}
                                            >
                                                {copy.upgrade}
                                            </Button>
                                            <TextAction appearance="inline" href={ROUTES.tasks}>
                                                {copy.manageTasks}
                                            </TextAction>
                                        </div>
                                        <div>
                                            <Text tone="muted">{copy.completeFreesSpace}</Text>
                                        </div>
                                    </>
                                ) : null}
                                {props.upgradeRefusal !== null ? (
                                    <Text live="assertive">{props.upgradeRefusal}</Text>
                                ) : null}
                            </>
                        ) : null}
                    </div>
                </SurfaceCard>
            </AccountShell>
        </GrammarRoot>
    )
}
