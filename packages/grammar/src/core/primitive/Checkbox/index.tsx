"use client"

import { Checkbox as HeroCheckbox } from "@heroui/react"
import type { ReactNode } from "react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    vendorFieldProps,
    type FieldControlProps,
} from "../Field/index.js"

export type CheckboxProps = Omit<FieldControlProps, "isLabelHidden"> & {
    /** The value submitted, and the value a CheckboxGroup collects. */
    readonly value?: string
    readonly isSelected?: boolean
    readonly defaultSelected?: boolean
    readonly onSelectedChange?: (isSelected: boolean) => void
    /** Mixed state for a parent of partially selected children. */
    readonly isIndeterminate?: boolean
}

/** Shared checkbox anatomy. Also rendered by CheckboxGroup for each of its options. */
export const CheckboxItem = ({ label, description, errorMessage, isStandalone }: {
    readonly label: ReactNode
    readonly description?: ReactNode
    readonly errorMessage?: ReactNode
    /** A standalone checkbox owns its error slot; inside a group the group owns it. */
    readonly isStandalone: boolean
}) => (
    <>
        <HeroCheckbox.Content className="starci-core-choice-content" data-grammar-choice-target="true">
            <HeroCheckbox.Control className="starci-core-choice-control" data-grammar-choice-control="checkbox">
                <HeroCheckbox.Indicator />
            </HeroCheckbox.Control>
            <FieldLabel>{label}</FieldLabel>
        </HeroCheckbox.Content>
        <FieldDescription>{description}</FieldDescription>
        {isStandalone ? <FieldErrorText>{errorMessage}</FieldErrorText> : null}
    </>
)

/**
 * One on/off choice with its label as part of the hit area. Space toggles; the vendor supplies the
 * native checkbox input, `aria-checked="mixed"` for indeterminate, and required/invalid wiring.
 */
export const Checkbox = ({
    value,
    isSelected,
    defaultSelected,
    onSelectedChange,
    isIndeterminate = false,
    ...field
}: CheckboxProps) => (
    <HeroCheckbox
        data-tier="atom"
        data-component="Checkbox"
        className="starci-core-choice starci-core-checkbox"
        {...vendorFieldProps(field)}
        isReadOnly={field.isReadOnly === true}
        isIndeterminate={isIndeterminate}
        {...(value === undefined ? {} : { value })}
        {...(isSelected === undefined ? defaultSelected === undefined ? {} : { defaultSelected } : { isSelected })}
        {...(onSelectedChange === undefined ? {} : { onChange: onSelectedChange })}
    >
        <CheckboxItem label={field.label} description={field.description} errorMessage={field.errorMessage} isStandalone />
    </HeroCheckbox>
)
