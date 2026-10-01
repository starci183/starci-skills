import { Button, Form, Heading, Input, RadioGroup, SurfaceCard, Text } from "@starci/grammar/common"
import { ROUTES } from "@/modules/routes"
import type { RecurFrequency, ScheduleField, ScheduleRefusal } from "@/modules/types"
import { SCHEDULE_ACTIONS_CLASS_NAME, SCHEDULE_FORM_CLASS_NAME } from "./classNames"

/** Every word the make-recurring form renders, resolved by the connected half. */
type ScheduleFormCopy = {
    readonly scheduleCard: string
    readonly repeatLabel: string
    readonly frequency: string
    readonly freqWeekday: string
    readonly freqNDays: string
    readonly freqMonthly: string
    readonly everyDays: string
    readonly dayOfMonth: string
    readonly timeOfDay: string
    readonly timeOfDayHint: string
    readonly timeZone: string
    readonly timeZoneHint: string
    readonly startDate: string
    readonly startDateHint: string
    readonly save: string
    readonly saving: string
    readonly cancel: string
}

/** The make-recurring form's complete contract: the draft as typed, the refusal in flight and every intent. */
export type ScheduleFormProps = {
    readonly copy: ScheduleFormCopy
    readonly frequency: RecurFrequency
    readonly n: string
    readonly dayOfMonth: string
    readonly time: string
    readonly timeZone: string
    readonly startDate: string
    readonly refusal: ScheduleRefusal | null
    readonly isSaving: boolean
    readonly onFrequencyChange: (value: RecurFrequency) => void
    readonly onNChange: (value: string) => void
    readonly onDayOfMonthChange: (value: string) => void
    readonly onTimeChange: (value: string) => void
    readonly onTimeZoneChange: (value: string) => void
    readonly onStartDateChange: (value: string) => void
    readonly onSubmit: () => void
}

/** The refusal sentence that belongs under one field, when the refusal names that field. */
const refusalFor = (refusal: ScheduleRefusal | null, field: ScheduleField): string | undefined =>
    refusal !== null && refusal.field === field ? refusal.message : undefined

/** The frequency a radio value names, or `null` for a value the group never offers. */
const toFrequency = (value: string): RecurFrequency | null =>
    value === "every-weekday" || value === "every-n-days" || value === "monthly-day" ? value : null

/** The make-recurring form ui.recur.schedule shows in its no-rule and refused states. */
export const ScheduleForm = (props: ScheduleFormProps) => {
    const copy = props.copy
    const isSaving = props.isSaving
    const formRefusal = refusalFor(props.refusal, "form")
    const frequencyOptions = [
        { value: "every-weekday", label: copy.freqWeekday },
        { value: "every-n-days", label: copy.freqNDays },
        { value: "monthly-day", label: copy.freqMonthly },
    ]
    const onFrequencyChange = (value: string) => {
        const frequency = toFrequency(value)
        if (frequency !== null) props.onFrequencyChange(frequency)
    }
    return (
        <SurfaceCard ariaLabel={copy.scheduleCard}>
            <Form label={copy.repeatLabel} onSubmit={props.onSubmit} isPending={isSaving}>
                <div className={SCHEDULE_FORM_CLASS_NAME}>
                    <Heading level={2}>{copy.scheduleCard}</Heading>
                    <RadioGroup
                        name="recur-frequency"
                        label={copy.frequency}
                        options={frequencyOptions}
                        value={props.frequency}
                        onValueChange={onFrequencyChange}
                        isDisabled={isSaving}
                    />
                    {props.frequency === "every-n-days" ? (
                        <Input
                            id="recur-n"
                            name="n"
                            label={copy.everyDays}
                            value={props.n}
                            isDisabled={isSaving}
                            errorMessage={refusalFor(props.refusal, "n")}
                            onValueChange={props.onNChange}
                        />
                    ) : null}
                    {props.frequency === "monthly-day" ? (
                        <Input
                            id="recur-day-of-month"
                            name="dayOfMonth"
                            label={copy.dayOfMonth}
                            value={props.dayOfMonth}
                            isDisabled={isSaving}
                            errorMessage={refusalFor(props.refusal, "dayOfMonth")}
                            onValueChange={props.onDayOfMonthChange}
                        />
                    ) : null}
                    <Input
                        id="recur-time"
                        name="time"
                        label={copy.timeOfDay}
                        hint={copy.timeOfDayHint}
                        value={props.time}
                        isDisabled={isSaving}
                        errorMessage={refusalFor(props.refusal, "time")}
                        onValueChange={props.onTimeChange}
                    />
                    <Input
                        id="recur-time-zone"
                        name="timeZone"
                        label={copy.timeZone}
                        hint={copy.timeZoneHint}
                        value={props.timeZone}
                        isDisabled={isSaving}
                        errorMessage={refusalFor(props.refusal, "timeZone")}
                        onValueChange={props.onTimeZoneChange}
                    />
                    <Input
                        id="recur-start-date"
                        name="startDate"
                        label={copy.startDate}
                        hint={copy.startDateHint}
                        value={props.startDate}
                        isDisabled={isSaving}
                        errorMessage={refusalFor(props.refusal, "startDate")}
                        onValueChange={props.onStartDateChange}
                    />
                    {formRefusal === undefined ? null : <Text live="assertive">{formRefusal}</Text>}
                    <div className={SCHEDULE_ACTIONS_CLASS_NAME}>
                        <Button type="submit" variant="primary" isDisabled={isSaving} isPending={isSaving}>
                            {isSaving ? copy.saving : copy.save}
                        </Button>
                        <Button variant="outline" href={ROUTES.tasks}>
                            {copy.cancel}
                        </Button>
                    </div>
                </div>
            </Form>
        </SurfaceCard>
    )
}
