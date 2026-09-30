"use client"

import { useTranslations } from "next-intl"
import { useSignOut } from "@/hooks/auth"
import { useSchedule } from "@/hooks/recur"
import { RecurWorkspaceView } from "./component"
import type { ScheduleState } from "./schedule-screen"
import type { RecurWorkspaceProps } from "./workspace"

/**
 * The connected owner of ui.recur.schedule: it holds the make-recurring lifecycle through
 * `useSchedule`, resolves the one schedule state and the shell's copy and sign-out action, and hands
 * every render path to the pure workspace view in ./component.tsx - the product shell (header, compact
 * chrome, intro, footer) around the schedule screen.
 */
export const RecurWorkspace = (props: RecurWorkspaceProps) => {
    const t = useTranslations("recur")
    const tShell = useTranslations("shell")
    const onSignOut = useSignOut()
    const schedule = useSchedule(props.taskTitle)
    const rule = schedule.rule

    const state: ScheduleState = rule === null ? (schedule.refusal === null ? "no-rule" : "refused") : rule.endedAt === null ? "active" : "ended"

    return (
        <RecurWorkspaceView
            {...props}
            t={t}
            tShell={tShell}
            onSignOut={onSignOut}
            schedule={{
                state,
                frequency: schedule.frequency,
                n: schedule.n,
                dayOfMonth: schedule.dayOfMonth,
                time: schedule.time,
                timeZone: schedule.timeZone,
                startDate: schedule.startDate,
                refusal: schedule.refusal,
                isSaving: schedule.isSaving,
                rule,
                upcoming: schedule.upcoming,
                isConfirmingEnd: schedule.isConfirmingEnd,
                isEnding: schedule.isEnding,
                onFrequencyChange: schedule.setFrequency,
                onNChange: schedule.setN,
                onDayOfMonthChange: schedule.setDayOfMonth,
                onTimeChange: schedule.setTime,
                onTimeZoneChange: schedule.setTimeZone,
                onStartDateChange: schedule.setStartDate,
                onSubmit: schedule.submit,
                onEndRule: () => schedule.setIsConfirmingEnd(true),
                onConfirmEndRule: schedule.confirmEndRule,
                onCancelEndRule: () => schedule.setIsConfirmingEnd(false),
            }}
        />
    )
}
