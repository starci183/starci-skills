"use client"

import {
    Calendar as HeroCalendar,
    DateField as HeroDateField,
    DatePicker as HeroDatePicker,
    RangeCalendar as HeroRangeCalendar,
    type DateValue,
} from "@heroui/react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    useGrammarPortal,
    vendorFieldProps,
    type FieldControlProps,
} from "../../primitive/Field/index.js"
import { DateSegments, type DateGranularity } from "../../primitive/DateField/index.js"

export type DatePickerProps = FieldControlProps & {
    readonly value?: DateValue | null
    readonly defaultValue?: DateValue | null
    readonly onValueChange?: (value: DateValue | null) => void
    readonly minValue?: DateValue
    readonly maxValue?: DateValue
    /** Days the reader may not pick; they stay visible and are announced unavailable. */
    readonly isDateUnavailable?: (date: DateValue) => boolean
    readonly granularity?: DateGranularity
}

/** Month grid used by DatePicker: heading, previous/next, and the day grid (arrow-key navigable). */
export const PickerCalendar = () => (
    <HeroCalendar className="starci-core-calendar" data-grammar-calendar="single">
        <HeroCalendar.Header className="starci-core-calendar-header">
            <HeroCalendar.NavButton slot="previous" className="starci-core-calendar-nav" />
            <HeroCalendar.Heading className="starci-core-calendar-heading" />
            <HeroCalendar.NavButton slot="next" className="starci-core-calendar-nav" />
        </HeroCalendar.Header>
        <HeroCalendar.Grid className="starci-core-calendar-grid">
            <HeroCalendar.GridHeader>{(day) => <HeroCalendar.HeaderCell>{day}</HeroCalendar.HeaderCell>}</HeroCalendar.GridHeader>
            <HeroCalendar.GridBody>{(date) => <HeroCalendar.Cell date={date} className="starci-core-calendar-cell" data-grammar-calendar-cell="true" />}</HeroCalendar.GridBody>
        </HeroCalendar.Grid>
    </HeroCalendar>
)

/** Month grid used by DateRangePicker: the same anatomy, selecting a start and an end. */
export const PickerRangeCalendar = () => (
    <HeroRangeCalendar className="starci-core-calendar" data-grammar-calendar="range">
        <HeroRangeCalendar.Header className="starci-core-calendar-header">
            <HeroRangeCalendar.NavButton slot="previous" className="starci-core-calendar-nav" />
            <HeroRangeCalendar.Heading className="starci-core-calendar-heading" />
            <HeroRangeCalendar.NavButton slot="next" className="starci-core-calendar-nav" />
        </HeroRangeCalendar.Header>
        <HeroRangeCalendar.Grid className="starci-core-calendar-grid">
            <HeroRangeCalendar.GridHeader>{(day) => <HeroRangeCalendar.HeaderCell>{day}</HeroRangeCalendar.HeaderCell>}</HeroRangeCalendar.GridHeader>
            <HeroRangeCalendar.GridBody>{(date) => <HeroRangeCalendar.Cell date={date} className="starci-core-calendar-cell" data-grammar-calendar-cell="true" />}</HeroRangeCalendar.GridBody>
        </HeroRangeCalendar.Grid>
    </HeroRangeCalendar>
)

/**
 * A date typed in segments or picked from a month grid in a popover. The trigger is a named button,
 * the popover is a dialog that traps and returns focus, and the grid is the vendor's.
 */
export const DatePicker = ({
    value,
    defaultValue,
    onValueChange,
    minValue,
    maxValue,
    isDateUnavailable,
    granularity = "day",
    ...field
}: DatePickerProps) => {
    const { anchor, portalProps } = useGrammarPortal()
    return (
        <HeroDatePicker
            data-tier="branch"
            data-component="DatePicker"
            className="starci-core-field starci-core-date-picker"
            {...vendorFieldProps(field)}
            isReadOnly={field.isReadOnly === true}
            granularity={granularity}
            {...(value === undefined ? defaultValue === undefined ? {} : { defaultValue } : { value })}
            {...(onValueChange === undefined ? {} : { onChange: onValueChange })}
            {...(minValue === undefined ? {} : { minValue })}
            {...(maxValue === undefined ? {} : { maxValue })}
            {...(isDateUnavailable === undefined ? {} : { isDateUnavailable })}
        >
            {anchor}
            <FieldLabel isHidden={field.isLabelHidden} isRequired={field.isRequired}>{field.label}</FieldLabel>
            <HeroDateField.Group className="starci-core-date-group" data-grammar-field-control="true">
                <DateSegments />
                <HeroDateField.Suffix className="starci-core-date-suffix">
                    <HeroDatePicker.Trigger className="starci-core-date-trigger">
                        <HeroDatePicker.TriggerIndicator />
                    </HeroDatePicker.Trigger>
                </HeroDateField.Suffix>
            </HeroDateField.Group>
            <FieldDescription>{field.description}</FieldDescription>
            <FieldErrorText>{field.errorMessage}</FieldErrorText>
            <HeroDatePicker.Popover className="starci-core-date-popover" data-grammar-popover="DatePicker" {...portalProps}>
                <PickerCalendar />
            </HeroDatePicker.Popover>
        </HeroDatePicker>
    )
}
