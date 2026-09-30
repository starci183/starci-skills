import { GrammarRoot, Heading, Text, TextAction, type BreadcrumbItem } from "@starci/grammar/common"
import { AccountShell, type AccountShellCopy } from "@/components/composites/AccountShell"
import { RuleSummary, type RuleSummaryProps } from "@/components/composites/RuleSummary"
import { ScheduleForm, type ScheduleFormProps } from "@/components/composites/ScheduleForm"
import { UpcomingList, type UpcomingListProps } from "@/components/composites/UpcomingList"
import { ROUTES } from "@/modules/routes"
import { INTRO_STACK_CLASS_NAME } from "./classNames"

/**
 * ui.recur.schedule states: no-rule, active, ended, refused. The connected owner in ./index.tsx
 * resolves which state applies from the make-recurring lifecycle and hands the view only what that
 * state draws: no-rule and refused share the make-recurring form (the record's refused behavior is
 * that the form keeps every submitted value and names the invalid field); active and ended replace
 * it with the rule summary and the occurrence collection.
 */
export type ScheduleState = "no-rule" | "active" | "ended" | "refused"

/** The one beside-it inventory the ScheduleState closed vocabulary is checked against. */
export const SCHEDULE_STATES: ReadonlyArray<ScheduleState> = ["no-rule", "active", "ended", "refused"] as const

/** Every word the recurrence screen draws around its three parts, resolved by the connected half. */
export type RecurViewCopy = AccountShellCopy & {
    readonly heading: string
    readonly noTask: string
    readonly backToTask: string
}

/** The recurrence screen's complete contract. */
export type RecurViewProps = {
    readonly state: ScheduleState
    /** The title of the task the rule is made from; `null` when the route named none. */
    readonly taskTitle: string | null
    readonly copy: RecurViewCopy
    readonly form: ScheduleFormProps
    /** The created rule's summary; `null` while there is no rule. */
    readonly summary: RuleSummaryProps | null
    readonly upcoming: UpcomingListProps
    readonly onSignOut: () => void
}

/** Draw the recurrence screen: the workspace chrome around the form, or the rule summary and its occurrences. */
export const RecurView = (props: RecurViewProps) => {
    const copy = props.copy
    const trail: ReadonlyArray<BreadcrumbItem> = [
        { id: "tasks", label: copy.destinations.tasks, href: ROUTES.tasks },
        ...(props.taskTitle === null ? [] : [{ id: "task", label: props.taskTitle, href: ROUTES.tasks }]),
        { id: "schedule", label: copy.breadcrumb },
    ]
    return (
        <GrammarRoot data-state={props.state}>
            <AccountShell copy={copy} currentHref={ROUTES.tasks} onSignOut={props.onSignOut} trail={trail}>
                <div className={INTRO_STACK_CLASS_NAME}>
                    <Heading level={1}>{copy.heading}</Heading>
                    {props.taskTitle === null ? (
                        <Text tone="muted">{copy.noTask}</Text>
                    ) : (
                        <Text>{props.taskTitle}</Text>
                    )}
                    <TextAction appearance="inline" href={ROUTES.tasks}>
                        {copy.backToTask}
                    </TextAction>
                </div>
                {props.summary === null ? (
                    <ScheduleForm {...props.form} />
                ) : (
                    <>
                        <RuleSummary {...props.summary} />
                        <UpcomingList {...props.upcoming} />
                    </>
                )}
            </AccountShell>
        </GrammarRoot>
    )
}
