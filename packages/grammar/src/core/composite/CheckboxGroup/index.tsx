"use client"

import { Checkbox as HeroCheckbox, CheckboxGroup as HeroCheckboxGroup } from "@heroui/react"
import type { ReactNode } from "react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    vendorFieldProps,
    type FieldControlProps,
} from "../../primitive/Field/index.js"
import { CheckboxItem } from "../../primitive/Checkbox/index.js"

/** One option in a choice group. */
export type ChoiceOption = {
    readonly value: string
    readonly label: ReactNode
    readonly description?: ReactNode
    readonly isDisabled?: boolean
}

export type ChoiceOrientation = "vertical" | "horizontal"

export type CheckboxGroupProps = FieldControlProps & {
    readonly options: ReadonlyArray<ChoiceOption>
    readonly value?: ReadonlyArray<string>
    readonly defaultValue?: ReadonlyArray<string>
    readonly onValueChange?: (value: Array<string>) => void
    readonly orientation?: ChoiceOrientation
}

/*
 * Consumer hook: `starci-core-choice-group` names this control's root for a consumer or family
 * stylesheet. No shipped sheet paints it: the root is drawn as a whole by `.starci-core-field`, so
 * a rule on the hook adds to the shared anatomy and never has to replace it.
 */

/*
 * Consumer hook: `starci-core-checkbox` names each option's root for a consumer or family
 * stylesheet. No shipped sheet paints it: the root is drawn as a whole by `.starci-core-choice`, so
 * a rule on the hook adds to the shared anatomy and never has to replace it.
 */

/**
 * Several independent choices under one group name (`role="group"`, labelled by the group label).
 * Required means "at least one", validated by the vendor; the group owns the one error slot.
 */
export const CheckboxGroup = ({
    options,
    value,
    defaultValue,
    onValueChange,
    orientation = "vertical",
    ...field
}: CheckboxGroupProps) => (
    <HeroCheckboxGroup
        data-tier="composite"
        data-component="CheckboxGroup"
        data-contract="A11Y-1 FIELD-1 FIELD-2 CONTROL-STATE-3"
        data-grammar-orientation={orientation}
        className="starci-core-field starci-core-choice-group"
        {...vendorFieldProps(field)}
        isReadOnly={field.isReadOnly === true}
        {...(value === undefined ? defaultValue === undefined ? {} : { defaultValue: [...defaultValue] } : { value: [...value] })}
        {...(onValueChange === undefined ? {} : { onChange: onValueChange })}
    >
        <FieldLabel isHidden={field.isLabelHidden} isRequired={field.isRequired}>{field.label}</FieldLabel>
        <FieldDescription>{field.description}</FieldDescription>
        <div className="starci-core-choice-group-options" data-grammar-field-control="true">
            {options.map((option) => (
                <HeroCheckbox
                    key={option.value}
                    value={option.value}
                    isDisabled={option.isDisabled === true}
                    className="starci-core-choice starci-core-checkbox"
                    data-grammar-option="true"
                >
                    <CheckboxItem label={option.label} description={option.description} isStandalone={false} />
                </HeroCheckbox>
            ))}
        </div>
        <FieldErrorText>{field.errorMessage}</FieldErrorText>
    </HeroCheckboxGroup>
)
