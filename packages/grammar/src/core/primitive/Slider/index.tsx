"use client"

import { Slider as HeroSlider } from "@heroui/react"
import { useId, useState } from "react"
import { FieldLabel, fieldStateAttributes, isFieldInvalid, type FieldControlProps } from "../Field/index.js"

/** One value, or one value per thumb for a range. */
export type SliderValue = number | ReadonlyArray<number>

export type SliderProps = FieldControlProps & {
    readonly value?: SliderValue
    readonly defaultValue?: SliderValue
    /** Every change while dragging or stepping. */
    readonly onValueChange?: (value: SliderValue) => void
    /** The value once the reader lets go - the moment to save or fetch. */
    readonly onValueCommit?: (value: SliderValue) => void
    readonly minValue?: number
    readonly maxValue?: number
    readonly step?: number
    readonly formatOptions?: Intl.NumberFormatOptions
    /** Accessible name per thumb for a range, e.g. minimum and maximum. */
    readonly thumbLabels?: ReadonlyArray<string>
    readonly orientation?: "horizontal" | "vertical"
}

const toVendor = (value: SliderValue): number | Array<number> => (typeof value === "number" ? value : [...value])

/**
 * A value on a continuous or stepped scale. Each thumb is a native range input under the hood, so
 * arrow keys, Page Up/Down, Home/End and screen-reader value announcements are the vendor's. The
 * vendor slider has no validation or read-only mode: description and error are wired to every thumb
 * through `aria-describedby`, and read-only holds the value while keeping the thumbs focusable.
 */
export const Slider = ({
    value,
    defaultValue,
    onValueChange,
    onValueCommit,
    minValue = 0,
    maxValue = 100,
    step,
    formatOptions,
    thumbLabels,
    orientation = "horizontal",
    label,
    isLabelHidden,
    description,
    errorMessage,
    isInvalid,
    isRequired,
    isDisabled,
    isReadOnly,
    name,
}: SliderProps) => {
    const id = useId().replace(/:/g, "")
    const [heldValue] = useState<SliderValue>(value ?? defaultValue ?? minValue)
    const invalid = isFieldInvalid({ isInvalid, errorMessage })
    const readOnly = isReadOnly === true
    const descriptionId = description == null ? undefined : `slider${id}-description`
    const errorId = invalid && errorMessage != null ? `slider${id}-error` : undefined
    const describedBy = [descriptionId, errorId].filter((part) => part !== undefined).join(" ")
    const selection = readOnly
        ? { value: toVendor(value ?? heldValue) }
        : value === undefined ? defaultValue === undefined ? {} : { defaultValue: toVendor(defaultValue) } : { value: toVendor(value) }

    return (
        <HeroSlider
            data-tier="atom"
            data-component="Slider"
            data-grammar-orientation={orientation}
            className="starci-core-field starci-core-slider"
            {...fieldStateAttributes({ isInvalid: invalid, isDisabled, isReadOnly, isRequired })}
            {...(isDisabled === true ? { isDisabled: true } : {})}
            orientation={orientation}
            minValue={minValue}
            maxValue={maxValue}
            {...(step === undefined ? {} : { step })}
            {...(formatOptions === undefined ? {} : { formatOptions })}
            {...selection}
            onChange={(next) => {
                if (!readOnly) onValueChange?.(next)
            }}
            onChangeEnd={(next) => {
                if (!readOnly) onValueCommit?.(next)
            }}
        >
            <div className="starci-core-slider-header">
                <FieldLabel isHidden={isLabelHidden} isRequired={isRequired}>{label}</FieldLabel>
                <HeroSlider.Output className="starci-core-slider-output" />
            </div>
            <HeroSlider.Track className="starci-core-slider-track" data-grammar-field-control="true">
                {({ state }) => (
                    <>
                        <HeroSlider.Fill className="starci-core-slider-fill" data-grammar-slider-fill="true" />
                        {state.values.map((_, index) => (
                            <HeroSlider.Thumb
                                key={index}
                                index={index}
                                className="starci-core-slider-thumb"
                                data-grammar-slider-thumb="true"
                                {...(name === undefined ? {} : { name })}
                                {...(thumbLabels?.[index] === undefined ? {} : { "aria-label": thumbLabels[index] })}
                                {...(describedBy === "" ? {} : { "aria-describedby": describedBy })}
                                {...(errorId === undefined ? {} : { "aria-errormessage": errorId })}
                            />
                        ))}
                    </>
                )}
            </HeroSlider.Track>
            {descriptionId === undefined ? null : (
                <span id={descriptionId} className="starci-core-field-description" data-grammar-field-description="true">{description}</span>
            )}
            {errorId === undefined ? null : (
                <span id={errorId} className="starci-core-field-error" data-grammar-field-error="true">{errorMessage}</span>
            )}
        </HeroSlider>
    )
}
