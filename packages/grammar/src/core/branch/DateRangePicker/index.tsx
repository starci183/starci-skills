"use client"

import {
    DateField as HeroDateField,
    DateRangePicker as HeroDateRangePicker,
    type DateValue,
    type RangeValue,
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
import { PickerRangeCalendar } from "../DatePicker/index.js"

export type DateRangeValue = RangeValue<DateValue>

export type DateRangePickerProps = Omit<FieldControlProps, "name"> & {
    readonly value?: DateRangeValue | null
    readonly defaultValue?: DateRangeValue | null
    readonly onValueChange?: (value: DateRangeValue | null) => void
    readonly minValue?: DateValue
    readonly maxValue?: DateValue
    readonly isDateUnavailable?: (date: DateValue) => boolean
    /** Lets a range span unavailable days; by default such a range is invalid. */
    readonly allowsNonContiguousRanges?: boolean
    readonly granularity?: DateGranularity
    /** Form names for the two ends of the range. */
    readonly startName?: string
    readonly endName?: string
}

/*
 * Consumer hook: `starci-core-date-picker` names this control's root for a consumer or family
 * stylesheet. No shipped sheet paints it: the root is drawn as a whole by `.starci-core-field`, so
 * a rule on the hook adds to the shared anatomy and never has to replace it.
 */

/*
 * Consumer hooks: `starci-core-date-popover`, `starci-core-date-suffix` name HeroUI parts whose
 * vendor paint Common leaves as it is. No shipped sheet paints them; the Grammar name lets a
 * consumer or family select those parts without reaching for vendor class names.
 */

/** A start and an end date, typed in two segment groups or picked as a span on a month grid. */
export const DateRangePicker = ({
    value,
    defaultValue,
    onValueChange,
    minValue,
    maxValue,
    isDateUnavailable,
    allowsNonContiguousRanges = false,
    granularity = "day",
    startName,
    endName,
    ...field
}: DateRangePickerProps) => {
    const { anchor, portalProps } = useGrammarPortal()
    return (
        <HeroDateRangePicker
            data-tier="branch"
            data-component="DateRangePicker"
            data-contract="A11Y-1 FIELD-1 FIELD-2"
            className="starci-core-field starci-core-date-picker"
            {...vendorFieldProps(field)}
            isReadOnly={field.isReadOnly === true}
            granularity={granularity}
            allowsNonContiguousRanges={allowsNonContiguousRanges}
            {...(value === undefined ? defaultValue === undefined ? {} : { defaultValue } : { value })}
            {...(onValueChange === undefined ? {} : { onChange: onValueChange })}
            {...(minValue === undefined ? {} : { minValue })}
            {...(maxValue === undefined ? {} : { maxValue })}
            {...(isDateUnavailable === undefined ? {} : { isDateUnavailable })}
            {...(startName === undefined ? {} : { startName })}
            {...(endName === undefined ? {} : { endName })}
        >
            {anchor}
            <FieldLabel isHidden={field.isLabelHidden} isRequired={field.isRequired}>{field.label}</FieldLabel>
            <HeroDateField.Group className="starci-core-date-group" data-grammar-field-control="true">
                <DateSegments slot="start" />
                <HeroDateRangePicker.RangeSeparator className="starci-core-date-range-separator" />
                <DateSegments slot="end" />
                <HeroDateField.Suffix className="starci-core-date-suffix">
                    <HeroDateRangePicker.Trigger className="starci-core-date-trigger">
                        <HeroDateRangePicker.TriggerIndicator />
                    </HeroDateRangePicker.Trigger>
                </HeroDateField.Suffix>
            </HeroDateField.Group>
            <FieldDescription>{field.description}</FieldDescription>
            <FieldErrorText>{field.errorMessage}</FieldErrorText>
            <HeroDateRangePicker.Popover className="starci-core-date-popover" data-grammar-popover="DateRangePicker" data-contract="LAYOUT-4 FOCUS-3" {...portalProps}>
                <PickerRangeCalendar />
            </HeroDateRangePicker.Popover>
        </HeroDateRangePicker>
    )
}
