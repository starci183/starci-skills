"use client"

import { ToggleButton as HeroToggleButton, ToggleButtonGroup as HeroToggleButtonGroup, type Key } from "@heroui/react"
import { useId, useState, type ReactNode } from "react"
import { fieldStateAttributes, isFieldInvalid, type FieldControlProps } from "../../primitive/Field/index.js"

export type SegmentOption = {
    readonly value: string
    readonly label: ReactNode
    /** Required when `label` is an icon only. */
    readonly accessibleLabel?: string
    readonly isDisabled?: boolean
}

export type SegmentedControlProps = FieldControlProps & {
    readonly options: ReadonlyArray<SegmentOption>
    readonly value?: string
    readonly defaultValue?: string
    readonly onValueChange?: (value: string) => void
    /** `fill` stretches the segments across the parent. */
    readonly width?: "content" | "fill"
}

const firstKey = (keys: Iterable<Key>): string | undefined => {
    for (const key of keys) return String(key)
    return undefined
}

/**
 * One-of-few choice drawn as joined segments (a toggle-button group in single-selection mode, so it
 * is announced as a radio group). A segment is never deselected by pressing it again. With `name`,
 * the selected value is submitted through a hidden input so it works inside a Form.
 */
export const SegmentedControl = ({
    options,
    value,
    defaultValue,
    onValueChange,
    width = "content",
    label,
    isLabelHidden,
    description,
    errorMessage,
    isInvalid,
    isRequired,
    isDisabled,
    isReadOnly,
    name,
}: SegmentedControlProps) => {
    const id = useId().replace(/:/g, "")
    const [held, setHeld] = useState<string | undefined>(value ?? defaultValue ?? options[0]?.value)
    const selected = value ?? held
    const invalid = isFieldInvalid({ isInvalid, errorMessage })
    const labelId = `segmented${id}-label`
    const descriptionId = description == null ? undefined : `segmented${id}-description`
    const errorId = invalid && errorMessage != null ? `segmented${id}-error` : undefined
    const describedBy = [descriptionId, errorId].filter((part) => part !== undefined).join(" ")

    return (
        <div
            data-tier="composite"
            data-component="SegmentedControl"
            data-contract="A11Y-1 FIELD-2"
            data-width={width}
            className="starci-core-field starci-core-segmented-control"
            {...fieldStateAttributes({ isInvalid: invalid, isDisabled, isReadOnly, isRequired })}
        >
            <span
                id={labelId}
                className={isLabelHidden === true ? "starci-core-field-label starci-core-form-label--screen-reader" : "starci-core-field-label"}
                data-grammar-field-label="true"
            >
                {label}
            </span>
            <HeroToggleButtonGroup
                aria-labelledby={labelId}
                {...(describedBy === "" ? {} : { "aria-describedby": describedBy })}
                selectionMode="single"
                disallowEmptySelection
                fullWidth={width === "fill"}
                {...(isDisabled === true ? { isDisabled: true } : {})}
                selectedKeys={selected === undefined ? [] : [selected]}
                onSelectionChange={(keys) => {
                    const next = firstKey(keys)
                    if (isReadOnly === true || next === undefined) return
                    setHeld(next)
                    onValueChange?.(next)
                }}
                className="starci-core-segmented-control-group"
                data-grammar-field-control="true"
                data-contract="STATE-6 FOCUS-2"
            >
                {options.map((option) => (
                    <HeroToggleButton
                        key={option.value}
                        id={option.value}
                        isDisabled={option.isDisabled === true}
                        className="starci-core-segment"
                        data-grammar-option="true"
                        {...(option.accessibleLabel === undefined ? {} : { "aria-label": option.accessibleLabel })}
                    >
                        {option.label}
                    </HeroToggleButton>
                ))}
            </HeroToggleButtonGroup>
            {name === undefined || selected === undefined ? null : <input type="hidden" name={name} value={selected} />}
            {descriptionId === undefined ? null : (
                <span id={descriptionId} className="starci-core-field-description" data-grammar-field-description="true">{description}</span>
            )}
            {errorId === undefined ? null : (
                <span id={errorId} className="starci-core-field-error" data-grammar-field-error="true" data-contract="FEEDBACK-1">{errorMessage}</span>
            )}
        </div>
    )
}
