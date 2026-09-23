"use client"

import { DateField as HeroDateField, type DateValue } from "@heroui/react"
import type { ReactNode } from "react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    isFieldInvalid,
    vendorFieldProps,
    type FieldControlProps,
} from "../Field/index.js"

export type DateGranularity = "day" | "hour" | "minute" | "second"

export type DateFieldProps = FieldControlProps & {
    readonly value?: DateValue | null
    readonly defaultValue?: DateValue | null
    readonly onValueChange?: (value: DateValue | null) => void
    readonly minValue?: DateValue
    readonly maxValue?: DateValue
    /** Smallest editable unit. `day` is a date; finer units add a time. */
    readonly granularity?: DateGranularity
}

// The vendor's own date-group slot classes. `DateField.Group` would stamp them from its context; the
// standalone box below renders without that Group (see DateFieldBox), so it names them itself.
const DATE_GROUP_CLASS = "date-input-group date-input-group--primary date-input-group--full-width starci-core-date-group"
const DATE_INPUT_CLASS = "date-input-group__input starci-core-date-input"
const DATE_SEGMENT_CLASS = "date-input-group__segment starci-core-date-segment"

/** The segmented date input (each part a spinbutton) shared by DateField, TimeField and the pickers. */
export const DateSegments = ({ slot }: { readonly slot?: "start" | "end" }) => (
    <HeroDateField.Input className={DATE_INPUT_CLASS} {...(slot === undefined ? {} : { slot })}>
        {(segment) => <HeroDateField.Segment segment={segment} className={DATE_SEGMENT_CLASS} />}
    </HeroDateField.Input>
)

/**
 * The field box around a standalone date or time input. A plain element with the vendor's group
 * paint, NOT the vendor `Group`: the date input already renders the one labelled `role="group"`,
 * and a second vendor Group would take the same id and name from the field context.
 */
export const DateFieldBox = ({ children, isInvalid, isDisabled }: {
    readonly children: ReactNode
    readonly isInvalid: boolean
    readonly isDisabled: boolean
}) => (
    <div
        className={DATE_GROUP_CLASS}
        data-slot="date-input-group"
        data-grammar-field-control="true"
        {...(isInvalid ? { "data-invalid": "true" } : {})}
        {...(isDisabled ? { "data-disabled": "true" } : {})}
    >
        {children}
    </div>
)

/**
 * A typed date: locale-ordered segments that each take digits and arrow keys, the vendor's. Values
 * are `@internationalized/date` objects (the vendor's `DateValue`), never ambiguous strings.
 */
export const DateField = ({
    value,
    defaultValue,
    onValueChange,
    minValue,
    maxValue,
    granularity = "day",
    ...field
}: DateFieldProps) => (
    <HeroDateField
        data-tier="atom"
        data-component="DateField"
        className="starci-core-field starci-core-date-field"
        fullWidth
        {...vendorFieldProps(field)}
        isReadOnly={field.isReadOnly === true}
        granularity={granularity}
        {...(value === undefined ? defaultValue === undefined ? {} : { defaultValue } : { value })}
        {...(onValueChange === undefined ? {} : { onChange: onValueChange })}
        {...(minValue === undefined ? {} : { minValue })}
        {...(maxValue === undefined ? {} : { maxValue })}
    >
        <FieldLabel isHidden={field.isLabelHidden} isRequired={field.isRequired}>{field.label}</FieldLabel>
        <DateFieldBox isInvalid={isFieldInvalid(field)} isDisabled={field.isDisabled === true}>
            <DateSegments />
        </DateFieldBox>
        <FieldDescription>{field.description}</FieldDescription>
        <FieldErrorText>{field.errorMessage}</FieldErrorText>
    </HeroDateField>
)
