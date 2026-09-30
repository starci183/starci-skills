"use client"

import { useTranslations } from "next-intl"
import { useSignOut } from "@/hooks/auth"
import { useSchedule } from "@/hooks/recur"
import { useAccountShellCopy } from "@/hooks/shell"
import type { RecurRule } from "@/modules/types"
import { RecurView, type ScheduleState } from "./component"

/** RecurBlock's only external input: the title of the task the query named, or `null` when it named none. */
type RecurBlockProps = {
    readonly taskTitle: string | null
}

/** The one sentence the active and ended states both show above the collection: the frequency phrase first. */
const summaryOf = (t: ReturnType<typeof useTranslations<"recur">>, rule: RecurRule): string => {
    const summary =
        rule.frequency === "every-weekday"
            ? t("summaryEveryWeekday")
            : rule.frequency === "every-n-days"
              ? rule.n === 1
                  ? t("summaryEveryDay")
                  : t("summaryEveryNDays", { n: rule.n ?? "?" })
              : t("summaryMonthlyDay", { day: rule.dayOfMonth ?? "?" })
    const frame = { summary, time: rule.time, timeZone: rule.timeZone, startDate: rule.startDate }
    return rule.endedAt === null
        ? t("ruleSummaryActive", frame)
        : t("ruleSummaryEnded", { ...frame, endedAt: rule.endedAt })
}

/**
 * The connected owner of ui.recur.schedule: it holds the make-recurring lifecycle through
 * `useSchedule`, resolves the one schedule state, the copy of each part and the shell's sign-out
 * action, and hands every render path to the pure view in ./component.tsx.
 */
export const RecurBlock = (props: RecurBlockProps) => {
    const t = useTranslations("recur")
    const tShell = useTranslations("shell")
    const shellCopy = useAccountShellCopy("recur")
    const onSignOut = useSignOut()
    const schedule = useSchedule(props.taskTitle)
    const rule = schedule.rule

    const state: ScheduleState =
        rule === null ? (schedule.refusal === null ? "no-rule" : "refused") : rule.endedAt === null ? "active" : "ended"

    return (
        <RecurView
            state={state}
            taskTitle={props.taskTitle}
            copy={{
                ...shellCopy,
                heading: t("heading"),
                noTask: t("noTask"),
                backToTask: tShell("backToTask"),
            }}
            form={{
                copy: {
                    scheduleCard: t("scheduleCard"),
                    repeatLabel: t("repeatLabel"),
                    frequency: t("frequency"),
                    freqWeekday: t("freqWeekday"),
                    freqNDays: t("freqNDays"),
                    freqMonthly: t("freqMonthly"),
                    everyDays: t("everyDays"),
                    dayOfMonth: t("dayOfMonth"),
                    timeOfDay: t("timeOfDay"),
                    timeOfDayHint: t("timeOfDayHint"),
                    timeZone: t("timeZone"),
                    timeZoneHint: t("timeZoneHint"),
                    startDate: t("startDate"),
                    startDateHint: t("startDateHint"),
                    save: t("save"),
                    saving: t("saving"),
                    cancel: t("cancel"),
                },
                frequency: schedule.frequency,
                n: schedule.n,
                dayOfMonth: schedule.dayOfMonth,
                time: schedule.time,
                timeZone: schedule.timeZone,
                startDate: schedule.startDate,
                refusal: schedule.refusal,
                isSaving: schedule.isSaving,
                onFrequencyChange: schedule.setFrequency,
                onNChange: schedule.setN,
                onDayOfMonthChange: schedule.setDayOfMonth,
                onTimeChange: schedule.setTime,
                onTimeZoneChange: schedule.setTimeZone,
                onStartDateChange: schedule.setStartDate,
                onSubmit: schedule.submit,
            }}
            summary={
                rule === null
                    ? null
                    : {
                          copy: {
                              scheduleCard: t("scheduleCard"),
                              summary: summaryOf(t, rule),
                              endRule: t("endRule"),
                              ending: t("ending"),
                              keepRule: t("keepRule"),
                              endConfirm: t("endConfirm"),
                          },
                          refusal: schedule.refusal === null ? null : schedule.refusal.message,
                          isActive: state === "active",
                          isConfirmingEnd: schedule.isConfirmingEnd,
                          isEnding: schedule.isEnding,
                          onEndRule: () => schedule.setIsConfirmingEnd(true),
                          onConfirmEndRule: schedule.confirmEndRule,
                          onCancelEndRule: () => schedule.setIsConfirmingEnd(false),
                      }
            }
            upcoming={{
                copy: {
                    upcoming: t("upcoming"),
                    previewNote: t("previewNote"),
                    nothingUpcoming: t("nothingUpcoming"),
                    endedNote: t("endedNote"),
                },
                isEnded: state === "ended",
                upcoming: schedule.upcoming,
            }}
            onSignOut={onSignOut}
        />
    )
}
