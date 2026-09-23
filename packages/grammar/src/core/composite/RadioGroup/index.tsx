"use client"

import { Radio as HeroRadio, RadioGroup as HeroRadioGroup } from "@heroui/react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    vendorFieldProps,
    type FieldControlProps,
} from "../../primitive/Field/index.js"
import type { ChoiceOption, ChoiceOrientation } from "../CheckboxGroup/index.js"

export type RadioGroupProps = FieldControlProps & {
    readonly options: ReadonlyArray<ChoiceOption>
    readonly value?: string | null
    readonly defaultValue?: string | null
    readonly onValueChange?: (value: string) => void
    readonly orientation?: ChoiceOrientation
}

/*
 * Consumer hook: `starci-core-choice-group` names this control's root for a consumer or family
 * stylesheet. No shipped sheet paints it: the root is drawn as a whole by `.starci-core-field`, so
 * a rule on the hook adds to the shared anatomy and never has to replace it.
 */

/*
 * Consumer hook: `starci-core-radio` names each option's root for a consumer or family stylesheet.
 * No shipped sheet paints it: the root is drawn as a whole by `.starci-core-choice`, so a rule on
 * the hook adds to the shared anatomy and never has to replace it.
 */

/**
 * Exactly one of a few visible choices (`role="radiogroup"`). Arrow keys move and select within the
 * group, Tab leaves it - roving focus is the vendor's.
 */
export const RadioGroup = ({
    options,
    value,
    defaultValue,
    onValueChange,
    orientation = "vertical",
    ...field
}: RadioGroupProps) => (
    <HeroRadioGroup
        data-tier="composite"
        data-component="RadioGroup"
        data-contract="A11Y-1 FIELD-1 STATE-6 FOCUS-2"
        data-grammar-orientation={orientation}
        className="starci-core-field starci-core-choice-group"
        orientation={orientation}
        {...vendorFieldProps(field)}
        isReadOnly={field.isReadOnly === true}
        {...(value === undefined ? defaultValue === undefined ? {} : { defaultValue } : { value })}
        {...(onValueChange === undefined ? {} : { onChange: onValueChange })}
    >
        <FieldLabel isHidden={field.isLabelHidden} isRequired={field.isRequired}>{field.label}</FieldLabel>
        <FieldDescription>{field.description}</FieldDescription>
        <div className="starci-core-choice-group-options" data-grammar-field-control="true">
            {options.map((option) => (
                <HeroRadio
                    key={option.value}
                    value={option.value}
                    isDisabled={option.isDisabled === true}
                    className="starci-core-choice starci-core-radio"
                    data-grammar-option="true"
                >
                    <HeroRadio.Content className="starci-core-choice-content" data-grammar-choice-target="true">
                        <HeroRadio.Control className="starci-core-choice-control" data-grammar-choice-control="radio">
                            <HeroRadio.Indicator />
                        </HeroRadio.Control>
                        <FieldLabel>{option.label}</FieldLabel>
                    </HeroRadio.Content>
                    <FieldDescription>{option.description}</FieldDescription>
                </HeroRadio>
            ))}
        </div>
        <FieldErrorText>{field.errorMessage}</FieldErrorText>
    </HeroRadioGroup>
)
