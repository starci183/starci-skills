import type { FormEvent } from "react"
import type { useTranslations } from "next-intl"
import { Button, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { Heading } from "@/components/leaves/Heading"
import { EndRuleConfirmBase } from "./end-rule-confirm"
import { UpcomingListBase } from "./upcoming-list"
import {
    FIELD_CONTROL_CLASS_NAME,
    FIELD_GROUP_CLASS_NAME,
    FIELD_LABEL_CLASS_NAME,
    RADIO_GROUP_CLASS_NAME,
    RADIO_INPUT_CLASS_NAME,
    RADIO_OPTION_CLASS_NAME,
    SCHEDULE_ACTIONS_CLASS_NAME,
    SCHEDULE_FORM_CLASS_NAME,
    SUMMARY_STACK_CLASS_NAME,
    UNDER_CONTROL_CLASS_NAME,
} from "./classNames"
import { ROUTES } from "@/modules/routes"
import type { RecurFrequency, RecurRule, ScheduleField, ScheduleRefusal, UpcomingOccurrences } from "@/modules/types"

/**
 * ui.recur.schedule states: no-rule, active, ended, refused. Every branch below is one of those
 * four names; there is no fifth rendering path. The connected owner in ./index.tsx resolves which
 * state applies and hands it down explicitly; this view never re-derives it from the API results.
 *
 * no-rule and refused share the make-recurring form (the record's refused behavior is that the
 * form keeps every submitted value and names the invalid field); active and ended replace it with
 * the rule summary and the occurrence collection.
 */
export type ScheduleState = "no-rule" | "active" | "ended" | "refused";

/** The one beside-it inventory the ScheduleState closed vocabulary is checked against. */
export const SCHEDULE_STATES: ReadonlyArray<ScheduleState> = ["no-rule", "active", "ended", "refused"] as const

/** The three frequencies' dictionary keys, in the direction's radio order. */
const FREQUENCY_OPTIONS: ReadonlyArray<{ readonly value: RecurFrequency; readonly labelKey: string }> = [
    { value: "every-weekday", labelKey: "freqWeekday" },
    { value: "every-n-days", labelKey: "freqNDays" },
    { value: "monthly-day", labelKey: "freqMonthly" },
] as const

/** The public props of the pure schedule screen view. */
export type ScheduleScreenViewProps = {
  readonly state: ScheduleState;
  readonly frequency: RecurFrequency;
  readonly n: string;
  readonly dayOfMonth: string;
  readonly time: string;
  readonly timeZone: string;
  readonly startDate: string;
  readonly refusal: ScheduleRefusal | null;
  readonly isSaving: boolean;
  readonly rule: RecurRule | null;
  readonly upcoming: UpcomingOccurrences | null;
  readonly isConfirmingEnd: boolean;
  readonly isEnding: boolean;
  readonly onFrequencyChange: (value: RecurFrequency) => void;
  readonly onNChange: (value: string) => void;
  readonly onDayOfMonthChange: (value: string) => void;
  readonly onTimeChange: (value: string) => void;
  readonly onTimeZoneChange: (value: string) => void;
  readonly onStartDateChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onEndRule: () => void;
  readonly onConfirmEndRule: () => void;
  readonly onCancelEndRule: () => void;
};

/** The props of one refusal line: the refusal in flight and the field this line answers for. */
export type RefusalLineProps = {
  readonly refusal: ScheduleRefusal | null;
  readonly field: ScheduleField;
};

const RefusalLine = (props: RefusalLineProps) =>
    props.refusal !== null && props.refusal.field === props.field ? (
        <div className={UNDER_CONTROL_CLASS_NAME}>
            <Text live="assertive">{props.refusal.message}</Text>
        </div>
    ) : null

const fieldProps = (isSaving: boolean) => ({ kind: "text" as const, isDisabled: isSaving })

/** The make-recurring form ui.recur.schedule shows in its no-rule and refused states. */
export type ScheduleScreenViewBaseProps = ScheduleScreenViewProps & { readonly t: ReturnType<typeof useTranslations<"recur">> }

const ScheduleForm = (props: ScheduleScreenViewBaseProps) => {
    const t = props.t
    const state = props.state
    const isSaving = props.isSaving
    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        props.onSubmit()
    }
    return (
        <SurfaceCard ariaLabel={t("scheduleCard")}>
            {/* The record's `Input (id: recur-rule, label: Repeat)` is this whole repeat-rule form. */}
            <form id="recur-rule" aria-label={t("repeatLabel")} data-state={state} onSubmit={onSubmit} className={SCHEDULE_FORM_CLASS_NAME}>
                <Heading level={2}>{t("scheduleCard")}</Heading>
                <div role="group" aria-labelledby="recur-frequency-label" className={FIELD_GROUP_CLASS_NAME}>
                    <span id="recur-frequency-label" className={FIELD_LABEL_CLASS_NAME}>{t("frequency")}</span>
                    <div className={FIELD_CONTROL_CLASS_NAME}>
                        <div className={RADIO_GROUP_CLASS_NAME}>
                            {FREQUENCY_OPTIONS.map(option => (
                                <label key={option.value} className={RADIO_OPTION_CLASS_NAME}>
                                    <input
                                        type="radio"
                                        name="recur-frequency"
                                        value={option.value}
                                        checked={props.frequency === option.value}
                                        disabled={isSaving}
                                        onChange={() => props.onFrequencyChange(option.value)}
                                        className={RADIO_INPUT_CLASS_NAME}
                                    />
                                    {t(option.labelKey)}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                {props.frequency === "every-n-days" ? (
                    <div>
                        <Input
                            id="recur-n"
                            name="n"
                            label={t("everyDays")}
                            {...fieldProps(isSaving)}
                            value={props.n}
                            onValueChange={props.onNChange}
                        />
                        <RefusalLine refusal={props.refusal} field="n" />
                    </div>
                ) : null}
                {props.frequency === "monthly-day" ? (
                    <div>
                        <Input
                            id="recur-day-of-month"
                            name="dayOfMonth"
                            label={t("dayOfMonth")}
                            {...fieldProps(isSaving)}
                            value={props.dayOfMonth}
                            onValueChange={props.onDayOfMonthChange}
                        />
                        <RefusalLine refusal={props.refusal} field="dayOfMonth" />
                    </div>
                ) : null}
                <div>
                    <Input
                        id="recur-time"
                        name="time"
                        label={t("timeOfDay")}
                        hint={t("timeOfDayHint")}
                        {...fieldProps(isSaving)}
                        value={props.time}
                        onValueChange={props.onTimeChange}
                    />
                    <RefusalLine refusal={props.refusal} field="time" />
                </div>
                <div>
                    <Input
                        id="recur-time-zone"
                        name="timeZone"
                        label={t("timeZone")}
                        hint={t("timeZoneHint")}
                        {...fieldProps(isSaving)}
                        value={props.timeZone}
                        onValueChange={props.onTimeZoneChange}
                    />
                    <RefusalLine refusal={props.refusal} field="timeZone" />
                </div>
                <div>
                    <Input
                        id="recur-start-date"
                        name="startDate"
                        label={t("startDate")}
                        hint={t("startDateHint")}
                        {...fieldProps(isSaving)}
                        value={props.startDate}
                        onValueChange={props.onStartDateChange}
                    />
                    <RefusalLine refusal={props.refusal} field="startDate" />
                </div>
                <RefusalLine refusal={props.refusal} field="form" />
                <div className={SCHEDULE_ACTIONS_CLASS_NAME}>
                    <Button type="submit" variant="primary" isDisabled={isSaving} isPending={isSaving}>
                        {isSaving ? t("saving") : t("save")}
                    </Button>
                    <Button variant="outline" href={ROUTES.tasks}>
                        {t("cancel")}
                    </Button>
                </div>
            </form>
        </SurfaceCard>
    )
}

/** Render the selected schedule state from resolved locale copy. */
export const ScheduleScreenViewBase = (props: ScheduleScreenViewBaseProps) => {
    const t = props.t
    const state = props.state
    if (state === "no-rule" || state === "refused") {
        return <ScheduleForm {...props} />
    }
    const rule = props.rule

    /* The one sentence the active and ended states both show above the collection: the frequency
   * phrase first, then the fixed frame around it. */
    const ruleSummary = (summaryRule: RecurRule): string => {
        const summary = summaryRule.frequency === "every-weekday"
            ? t("summaryEveryWeekday")
            : summaryRule.frequency === "every-n-days"
                ? summaryRule.n === 1 ? t("summaryEveryDay") : t("summaryEveryNDays", { n: summaryRule.n ?? "?" })
                : t("summaryMonthlyDay", { day: summaryRule.dayOfMonth ?? "?" })
        return summaryRule.endedAt === null
            ? t("ruleSummaryActive", { summary, time: summaryRule.time, timeZone: summaryRule.timeZone, startDate: summaryRule.startDate })
            : t("ruleSummaryEnded", { summary, time: summaryRule.time, timeZone: summaryRule.timeZone, startDate: summaryRule.startDate, endedAt: summaryRule.endedAt })
    }
    return (
        <>
            <SurfaceCard ariaLabel={t("scheduleCard")}>
                <div className={SUMMARY_STACK_CLASS_NAME}>
                    <Heading level={2}>{t("scheduleCard")}</Heading>
                    {rule === null ? null : <Text>{ruleSummary(rule)}</Text>}
                    <RefusalLine refusal={props.refusal} field="form" />
                    {state === "active" ? (
                        props.isConfirmingEnd ? (
                            <EndRuleConfirmBase t={t} isEnding={props.isEnding} onConfirm={props.onConfirmEndRule} onCancel={props.onCancelEndRule} />
                        ) : (
                            <Button type="button" variant="outline" onPress={props.onEndRule}>
                                {t("endRule")}
                            </Button>
                        )
                    ) : null}
                </div>
            </SurfaceCard>
            <UpcomingListBase t={t} isEnded={state === "ended"} upcoming={props.upcoming} />
        </>
    )
}
