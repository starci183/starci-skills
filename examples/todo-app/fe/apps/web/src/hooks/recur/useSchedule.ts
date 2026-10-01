import { useState } from "react"
import { useTranslations } from "next-intl"
import { useSessionToken } from "@/hooks/auth"
import { todayInZone } from "@/modules/i18n"
import { endRecurrence, makeRecurring, readUpcomingOccurrences } from "@/modules/recur"
import type { RecurRule, ScheduleRefusal, UpcomingOccurrences } from "@/modules/types"
import { validateDraft, WIRE_FREQUENCY } from "./recur.shared"
import { useScheduleDraft } from "./useScheduleDraft"

/**
 * ui.recur.schedule's world state: the make-recurring draft (`useScheduleDraft`), the field
 * validation the record's refused state names, and the created rule's lifecycle through the recur
 * capability's named calls (makeRecurring / upcomingOccurrences / endRecurrence).
 *
 * The screen's task context arrives as `taskTitle`: the title of the task the rule is made from, which
 * is exactly the identity the makeRecurring contract accepts. There is no list-rules query to
 * rediscover an existing rule on load, so a fresh visit is no-rule; a created rule's identity comes
 * from the makeRecurring response in this page's own session.
 */
export const useSchedule = (taskTitle: string | null) => {
    const t = useTranslations("recur")
    const token = useSessionToken()
    const form = useScheduleDraft()
    const [rule, setRule] = useState<RecurRule | null>(null)
    const [upcoming, setUpcoming] = useState<UpcomingOccurrences | null>(null)
    const [refusal, setRefusal] = useState<ScheduleRefusal | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isConfirmingEnd, setIsConfirmingEnd] = useState(false)
    const [isEnding, setIsEnding] = useState(false)

    const refreshUpcoming = async (ruleId: string): Promise<void> => {
        const outcome = await readUpcomingOccurrences(token, ruleId)
        setUpcoming(outcome.kind === "ok" ? outcome.data : { materialised: [], previewDates: [] })
    }

    const submit = async (): Promise<void> => {
        const draft = form.draft
        const draftRefusal = validateDraft(draft, {
            n: t("refusalN"),
            dayOfMonth: t("refusalDayOfMonth"),
            time: t("refusalTime"),
            timeZone: t("refusalTimeZone"),
            startDate: t("refusalStartDate"),
        })
        if (draftRefusal !== null) {
            setRefusal(draftRefusal)
            return
        }
        if (taskTitle === null) {
            setRefusal({ field: "form", message: t("refusalNoTask") })
            return
        }
        setIsSaving(true)
        setRefusal(null)
        const outcome = await makeRecurring(token, {
            title: taskTitle,
            frequency: WIRE_FREQUENCY[draft.frequency],
            ...(draft.frequency === "every-n-days" ? { n: Number.parseInt(draft.n, 10) } : {}),
            ...(draft.frequency === "monthly-day" ? { dayOfMonth: Number.parseInt(draft.dayOfMonth, 10) } : {}),
            timeZone: draft.timeZone,
            time: draft.time,
            startDate: draft.startDate,
        })
        if (outcome.kind !== "ok") {
            setIsSaving(false)
            setRefusal({ field: "form", message: t("refusalServer") })
            return
        }
        setRule({
            ruleId: outcome.data.ruleId,
            title: outcome.data.title,
            frequency: draft.frequency,
            n: draft.frequency === "every-n-days" ? Number.parseInt(draft.n, 10) : null,
            dayOfMonth: draft.frequency === "monthly-day" ? Number.parseInt(draft.dayOfMonth, 10) : null,
            time: outcome.data.time,
            timeZone: outcome.data.timeZone,
            startDate: outcome.data.startDate,
            endedAt: null,
        })
        setIsSaving(false)
        await refreshUpcoming(outcome.data.ruleId)
    }

    const confirmEndRule = async (): Promise<void> => {
        if (rule === null) return
        setIsEnding(true)
        const outcome = await endRecurrence(token, rule.ruleId, todayInZone(rule.timeZone))
        setIsEnding(false)
        if (outcome.kind !== "ok") {
            setRefusal({ field: "form", message: t("refusalServer") })
            return
        }
        setRule({ ...rule, endedAt: outcome.data.endedAt })
        setIsConfirmingEnd(false)
        await refreshUpcoming(rule.ruleId)
    }

    return {
        ...form.draft,
        setFrequency: form.setFrequency,
        setN: form.setN,
        setDayOfMonth: form.setDayOfMonth,
        setTime: form.setTime,
        setTimeZone: form.setTimeZone,
        setStartDate: form.setStartDate,
        rule,
        upcoming,
        refusal,
        isSaving,
        isConfirmingEnd,
        isEnding,
        setIsConfirmingEnd,
        submit,
        confirmEndRule,
    }
}
