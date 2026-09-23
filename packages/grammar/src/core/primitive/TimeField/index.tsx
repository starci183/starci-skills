"use client"

import { TimeField as HeroTimeField, type TimeValue } from "@heroui/react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    isFieldInvalid,
    vendorFieldProps,
    type FieldControlProps,
} from "../Field/index.js"
import { DateFieldBox, DateSegments } from "../DateField/index.js"

export type TimeFieldProps = FieldControlProps & {
    readonly value?: TimeValue | null
    readonly defaultValue?: TimeValue | null
    readonly onValueChange?: (value: TimeValue | null) => void
    readonly minValue?: TimeValue
    readonly maxValue?: TimeValue
    readonly granularity?: "hour" | "minute" | "second"
    /** Forces 12- or 24-hour display; the locale decides by default. */
    readonly hourCycle?: 12 | 24
}

/** A typed time of day in locale-ordered spinbutton segments. */
export const TimeField = ({
    value,
    defaultValue,
    onValueChange,
    minValue,
    maxValue,
    granularity = "minute",
    hourCycle,
    ...field
}: TimeFieldProps) => (
    <HeroTimeField
        data-tier="atom"
        data-component="TimeField"
        className="starci-core-field starci-core-time-field"
        fullWidth
        {...vendorFieldProps(field)}
        isReadOnly={field.isReadOnly === true}
        granularity={granularity}
        {...(hourCycle === undefined ? {} : { hourCycle })}
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
    </HeroTimeField>
)
