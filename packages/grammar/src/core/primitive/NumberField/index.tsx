"use client"

import { NumberField as HeroNumberField } from "@heroui/react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    vendorFieldProps,
    type FieldControlProps,
} from "../Field/index.js"

export type NumberFieldProps = FieldControlProps & {
    readonly id?: string
    readonly placeholder?: string
    readonly value?: number
    readonly defaultValue?: number
    readonly onValueChange?: (value: number) => void
    readonly minValue?: number
    readonly maxValue?: number
    readonly step?: number
    /** Locale-aware display, e.g. `{ style: "percent" }` or a currency. */
    readonly formatOptions?: Intl.NumberFormatOptions
    /** Hides the stepper buttons; arrow keys, Page Up/Down and Home/End still step. */
    readonly hideSteppers?: boolean
}

/**
 * A number with stepping. The vendor owns `role="spinbutton"`-equivalent semantics on the input,
 * locale parsing, arrow-key and wheel stepping, clamping to min/max and the localized stepper names.
 */
export const NumberField = ({
    id,
    placeholder,
    value,
    defaultValue,
    onValueChange,
    minValue,
    maxValue,
    step,
    formatOptions,
    hideSteppers = false,
    ...field
}: NumberFieldProps) => (
    <HeroNumberField
        data-tier="atom"
        data-component="NumberField"
        className="starci-core-field starci-core-number-field"
        fullWidth
        {...vendorFieldProps(field)}
        isReadOnly={field.isReadOnly === true}
        {...(value === undefined ? defaultValue === undefined ? {} : { defaultValue } : { value })}
        {...(onValueChange === undefined ? {} : { onChange: onValueChange })}
        {...(minValue === undefined ? {} : { minValue })}
        {...(maxValue === undefined ? {} : { maxValue })}
        {...(step === undefined ? {} : { step })}
        {...(formatOptions === undefined ? {} : { formatOptions })}
    >
        <FieldLabel isHidden={field.isLabelHidden} isRequired={field.isRequired}>{field.label}</FieldLabel>
        <HeroNumberField.Group className="starci-core-number-field-group" data-grammar-field-control="true">
            {hideSteppers ? null : <HeroNumberField.DecrementButton className="starci-core-number-field-step" />}
            <HeroNumberField.Input
                {...(id === undefined ? {} : { id })}
                {...(placeholder === undefined ? {} : { placeholder })}
                className="starci-core-number-field-input"
            />
            {hideSteppers ? null : <HeroNumberField.IncrementButton className="starci-core-number-field-step" />}
        </HeroNumberField.Group>
        <FieldDescription>{field.description}</FieldDescription>
        <FieldErrorText>{field.errorMessage}</FieldErrorText>
    </HeroNumberField>
)
