"use client"

import { Calendar as HeroCalendar, type DateValue } from "@heroui/react"
import { navigationClassName } from "../../navigationClassNames.js"

export type CalendarProps = {
    /** Names the calendar, e.g. "Delivery date". */
    readonly label: string
    /** Controlled selected date. Omit for uncontrolled use with `defaultValue`. */
    readonly value?: DateValue | null
    readonly defaultValue?: DateValue
    readonly onChange?: (value: DateValue) => void
    readonly minValue?: DateValue
    readonly maxValue?: DateValue
    readonly isDateUnavailable?: (date: DateValue) => boolean
    readonly isDisabled?: boolean
    readonly isReadOnly?: boolean
    /** App-owned accessible names of the month navigation buttons. */
    readonly previousLabel: string
    readonly nextLabel: string
    readonly className?: string
}

/**
 * A standalone month calendar (not a date field). Arrow keys move by day/week, Page Up/Down by
 * month, Home/End to the week edges; today, the selected date and unavailable dates are exposed by
 * the vendor as `data-*` states on each cell, with `aria-selected` on the chosen day.
 */
export const Calendar = ({
    label,
    value,
    defaultValue,
    onChange,
    minValue,
    maxValue,
    isDateUnavailable,
    isDisabled = false,
    isReadOnly = false,
    previousLabel,
    nextLabel,
    className,
}: CalendarProps) => (
    <HeroCalendar
        aria-label={label}
        className={navigationClassName("starci-core-calendar", className)}
        data-component="Calendar"
        data-tier="branch"
        isDisabled={isDisabled}
        isReadOnly={isReadOnly}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        {...(onChange === undefined ? {} : { onChange })}
        {...(minValue === undefined ? {} : { minValue })}
        {...(maxValue === undefined ? {} : { maxValue })}
        {...(isDateUnavailable === undefined ? {} : { isDateUnavailable })}
    >
        <HeroCalendar.Header className="starci-core-calendar-header">
            <HeroCalendar.NavButton aria-label={previousLabel} className="starci-core-calendar-nav" slot="previous" />
            <HeroCalendar.Heading className="starci-core-calendar-heading" />
            <HeroCalendar.NavButton aria-label={nextLabel} className="starci-core-calendar-nav" slot="next" />
        </HeroCalendar.Header>
        <HeroCalendar.Grid className="starci-core-calendar-month">
            <HeroCalendar.GridHeader>
                {(day: string) => <HeroCalendar.HeaderCell className="starci-core-calendar-weekday">{day}</HeroCalendar.HeaderCell>}
            </HeroCalendar.GridHeader>
            <HeroCalendar.GridBody>
                {(date) => <HeroCalendar.Cell className="starci-core-calendar-day" data-grammar-calendar-day="true" date={date} />}
            </HeroCalendar.GridBody>
        </HeroCalendar.Grid>
    </HeroCalendar>
)
