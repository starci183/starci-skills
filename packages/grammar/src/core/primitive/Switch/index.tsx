"use client"

import { Switch as HeroSwitch } from "@heroui/react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    FieldSkeleton,
    vendorFieldProps,
    type FieldControlProps,
} from "../Field/index.js"

export type SwitchProps = Omit<FieldControlProps, "isLabelHidden"> & {
    readonly value?: string
    readonly isSelected?: boolean
    readonly defaultSelected?: boolean
    readonly onSelectedChange?: (isSelected: boolean) => void
    /**
     * Initial unresolved content (knowledge STATE-8): the label stays real text and the switch track becomes a Skeleton of the same size,
     * `aria-hidden`, no `role="switch"` and nothing focusable; the root is `aria-busy`.
     */
    readonly isSkeleton?: boolean
}

/*
 * Consumer hook: `starci-core-switch` names this control's root for a consumer or family
 * stylesheet. No shipped sheet paints it: the root is drawn as a whole by `.starci-core-choice`, so
 * a rule on the hook adds to the shared anatomy and never has to replace it.
 */

/**
 * An immediate on/off setting (`role="switch"`). Use Checkbox for a choice that only takes effect
 * on submit. The label is part of the hit area; Space toggles.
 */
export const Switch = ({ value, isSelected, defaultSelected, onSelectedChange, isSkeleton = false, ...field }: SwitchProps) => isSkeleton ? (
    <FieldSkeleton component="Switch" tier="atom" label={field.label} isRequired={field.isRequired} kind="switch" className="starci-core-switch" />
) : (
    <HeroSwitch
        data-tier="atom"
        data-component="Switch"
        data-contract="A11Y-1 STATE-1"
        className="starci-core-choice starci-core-switch"
        {...vendorFieldProps(field)}
        isReadOnly={field.isReadOnly === true}
        {...(value === undefined ? {} : { value })}
        {...(isSelected === undefined ? defaultSelected === undefined ? {} : { defaultSelected } : { isSelected })}
        {...(onSelectedChange === undefined ? {} : { onChange: onSelectedChange })}
    >
        <HeroSwitch.Content className="starci-core-choice-content" data-grammar-choice-target="true">
            <HeroSwitch.Control className="starci-core-choice-control" data-grammar-choice-control="switch">
                <HeroSwitch.Thumb />
            </HeroSwitch.Control>
            <FieldLabel>{field.label}</FieldLabel>
        </HeroSwitch.Content>
        <FieldDescription>{field.description}</FieldDescription>
        <FieldErrorText>{field.errorMessage}</FieldErrorText>
    </HeroSwitch>
)
