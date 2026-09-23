"use client"

import { TextArea as HeroTextArea, TextField as HeroTextField } from "@heroui/react"
import { useState } from "react"
import {
    FieldDescription,
    FieldErrorText,
    FieldLabel,
    isFieldInvalid,
    vendorFieldProps,
    type FieldControlProps,
} from "../Field/index.js"

export type TextareaProps = FieldControlProps & {
    readonly id?: string
    readonly placeholder?: string
    readonly value?: string
    readonly defaultValue?: string
    /** Initial visible lines. The field still grows with the reader's own resize. */
    readonly rows?: number
    /** Also shows a live `count / max` beside the guidance. */
    readonly maxLength?: number
    readonly minLength?: number
    readonly onValueChange?: (value: string) => void
}

/*
 * Consumer hook: `starci-core-textarea` names this control's root for a consumer or family
 * stylesheet. No shipped sheet paints it: the root is drawn as a whole by `.starci-core-field`, so
 * a rule on the hook adds to the shared anatomy and never has to replace it.
 */

/** Multi-line text with the shared field anatomy. */
export const Textarea = ({
    id,
    placeholder,
    value,
    defaultValue,
    rows = 4,
    maxLength,
    minLength,
    onValueChange,
    ...field
}: TextareaProps) => {
    const [uncontrolledLength, setUncontrolledLength] = useState((defaultValue ?? "").length)
    const length = value === undefined ? uncontrolledLength : value.length

    return (
        <HeroTextField
            data-tier="atom"
            data-component="Textarea"
            data-contract="A11Y-1 FIELD-1 FIELD-2 FIELD-3"
            className="starci-core-field starci-core-textarea"
            fullWidth
            {...vendorFieldProps(field)}
            isReadOnly={field.isReadOnly === true}
            {...(value === undefined ? defaultValue === undefined ? {} : { defaultValue } : { value })}
            {...(maxLength === undefined ? {} : { maxLength })}
            {...(minLength === undefined ? {} : { minLength })}
            onChange={(next) => {
                setUncontrolledLength(next.length)
                onValueChange?.(next)
            }}
        >
            <FieldLabel isHidden={field.isLabelHidden} isRequired={field.isRequired}>{field.label}</FieldLabel>
            <HeroTextArea
                {...(id === undefined ? {} : { id })}
                rows={rows}
                {...(placeholder === undefined ? {} : { placeholder })}
                className="starci-core-textarea-control"
                data-grammar-field-control="true"
            />
            {field.description == null && maxLength === undefined ? null : (
                <div className="starci-core-field-meta">
                    <FieldDescription>{field.description}</FieldDescription>
                    {maxLength === undefined ? null : (
                        <span
                            className="starci-core-field-count"
                            data-grammar-field-count="true"
                            data-grammar-invalid={isFieldInvalid(field) || length > maxLength ? "true" : "false"}
                        >
                            {length}/{maxLength}
                        </span>
                    )}
                </div>
            )}
            <FieldErrorText>{field.errorMessage}</FieldErrorText>
        </HeroTextField>
    )
}
