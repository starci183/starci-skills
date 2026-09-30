import { useState } from "react"
import { useHydrated } from "@/hooks/hydration"
import { localTimeZone, todayInZone } from "@/modules/i18n"
import type { RecurFrequency } from "@/modules/types"
import type { ScheduleDraft } from "./recur.shared"

/** What the owner changed so far; a field left `null` still answers with the reader's own default. */
type DraftEdits = {
    readonly frequency: RecurFrequency
    readonly n: string
    readonly dayOfMonth: string
    readonly time: string
    readonly timeZone: string | null
    readonly startDate: string | null
}

const INITIAL_EDITS: DraftEdits = {
    frequency: "every-weekday",
    n: "",
    dayOfMonth: "",
    time: "09:00",
    timeZone: null,
    startDate: null,
}

/**
 * The make-recurring form's draft as intrinsic form state. The time zone and start date default to
 * the owner's own (fr.recur.make-recurring); they are read from the device rather than stored, and
 * they wait for hydration, so the server render and the client's first render agree.
 */
export const useScheduleDraft = () => {
    const [edits, setEdits] = useState<DraftEdits>(INITIAL_EDITS)
    const hydrated = useHydrated()
    const deviceZone = hydrated ? localTimeZone() : ""
    const timeZone = edits.timeZone ?? deviceZone
    const startDate = edits.startDate ?? (deviceZone === "" ? "" : todayInZone(deviceZone))
    const draft: ScheduleDraft = {
        frequency: edits.frequency,
        n: edits.n,
        dayOfMonth: edits.dayOfMonth,
        time: edits.time,
        timeZone,
        startDate,
    }
    return {
        draft,
        setFrequency: (frequency: RecurFrequency) => setEdits((current) => ({ ...current, frequency })),
        setN: (n: string) => setEdits((current) => ({ ...current, n })),
        setDayOfMonth: (dayOfMonth: string) => setEdits((current) => ({ ...current, dayOfMonth })),
        setTime: (time: string) => setEdits((current) => ({ ...current, time })),
        setTimeZone: (value: string) => setEdits((current) => ({ ...current, timeZone: value })),
        setStartDate: (value: string) => setEdits((current) => ({ ...current, startDate: value })),
    }
}
