import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { useSessionToken } from "@/hooks/auth"
import { endRecurrence, makeRecurring, readUpcomingOccurrences } from "@/modules/recur"
import type { RecurFrequency, RecurRule, ScheduleRefusal, UpcomingOccurrences } from "@/modules/types"
import { todayInZone, validateDraft, WIRE_FREQUENCY } from "./recur.shared"

/**
 * ui.recur.schedule's world state: the make-recurring draft as intrinsic form state, the field
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
    const [frequency, setFrequency] = useState<RecurFrequency>("every-weekday")
    const [n, setN] = useState("")
    const [dayOfMonth, setDayOfMonth] = useState("")
    const [time, setTime] = useState("09:00")
    const [timeZone, setTimeZone] = useState("")
    const [startDate, setStartDate] = useState("")
    const [rule, setRule] = useState<RecurRule | null>(null)
    const [upcoming, setUpcoming] = useState<UpcomingOccurrences | null>(null)
    const [refusal, setRefusal] = useState<ScheduleRefusal | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isConfirmingEnd, setIsConfirmingEnd] = useState(false)
    const [isEnding, setIsEnding] = useState(false)

    // fr.recur.make-recurring: time zone and start date default to the owner's own. Resolved after
    // mount rather than in initial state so the server render and the client's first render agree.
    useEffect(() => {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
        setTimeZone(current => (current === "" ? zone : current))
        setStartDate(current => (current === "" ? todayInZone(zone) : current))
    }, [])

    const refreshUpcoming = async (ruleId: string): Promise<void> => {
        const result = await readUpcomingOccurrences(token, ruleId)
        setUpcoming(result.ok ? result.data : { materialised: [], previewDates: [] })
    }

    const submit = async (): Promise<void> => {
        const draftRefusal = validateDraft(
            { frequency, n, dayOfMonth, time, timeZone, startDate },
            {
                n: t("refusalN"),
                dayOfMonth: t("refusalDayOfMonth"),
                time: t("refusalTime"),
                timeZone: t("refusalTimeZone"),
                startDate: t("refusalStartDate"),
            },
        )
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
        const result = await makeRecurring(token, {
            title: taskTitle,
            frequency: WIRE_FREQUENCY[frequency],
            ...(frequency === "every-n-days" ? { n: Number.parseInt(n, 10) } : {}),
            ...(frequency === "monthly-day" ? { dayOfMonth: Number.parseInt(dayOfMonth, 10) } : {}),
            timeZone,
            time,
            startDate,
        })
        if (!result.ok) {
            setIsSaving(false)
            setRefusal({ field: "form", message: result.reason })
            return
        }
        setRule({
            ruleId: result.data.ruleId,
            title: result.data.title,
            frequency,
            n: frequency === "every-n-days" ? Number.parseInt(n, 10) : null,
            dayOfMonth: frequency === "monthly-day" ? Number.parseInt(dayOfMonth, 10) : null,
            time: result.data.time,
            timeZone: result.data.timeZone,
            startDate: result.data.startDate,
            endedAt: null,
        })
        setIsSaving(false)
        await refreshUpcoming(result.data.ruleId)
    }

    const confirmEndRule = async (): Promise<void> => {
        if (rule === null) return
        setIsEnding(true)
        const result = await endRecurrence(token, rule.ruleId, todayInZone(rule.timeZone))
        setIsEnding(false)
        if (!result.ok) {
            setRefusal({ field: "form", message: result.reason })
            return
        }
        setRule({ ...rule, endedAt: result.data.endedAt })
        setIsConfirmingEnd(false)
        await refreshUpcoming(rule.ruleId)
    }

    return {
        frequency, n, dayOfMonth, time, timeZone, startDate,
        setFrequency, setN, setDayOfMonth, setTime, setTimeZone, setStartDate,
        rule, upcoming, refusal, isSaving, isConfirmingEnd, isEnding, setIsConfirmingEnd,
        submit, confirmEndRule,
    }
}
