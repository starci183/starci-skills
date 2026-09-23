"use client"

import { useCallback, useId, useRef } from "react"
import { InputOTP, Label as HeroLabel, REGEXP_ONLY_DIGITS } from "@heroui/react"
import { horizontalScrollRegionClassName } from "./classNames.js"
import { HorizontalScrollRegion } from "./composite/HorizontalScrollRegion/index.js"

export type OtpInputProps = {
    readonly id: string
    readonly name: string
    /**
     * Visible name of the code, e.g. "Verification code". It is drawn above the slots as a
     * `<label for={id}>` and names both the slot group (`role="group"`) and the one real input.
     */
    readonly label?: string
    /** Keep `label` as the accessible name but hide the drawn text. */
    readonly isLabelHidden?: boolean
    /** Id of an app-owned element (a Field label, a heading) that names the code instead of `label`. */
    readonly labelledBy?: string
    readonly defaultValue?: string
    readonly disabled?: boolean
    readonly invalid?: boolean
    readonly describedBy?: string
    readonly onChange?: (value: string) => void
}

/**
 * Own the conventional six-digit OTP control and its intrinsic-width overflow treatment.
 *
 * The slot strip is a `role="group"` named by `label` (or `labelledBy`), and the single hidden
 * `<input>` that receives the code carries the same name, so the control is announced as, e.g.,
 * "Verification code, group" and "Verification code, edit text". The strip scrolls only the slots,
 * which the focused input already reaches, so the region adds no extra Tab stop.
 */
export const OtpInput = (props: OtpInputProps) => {
    const regionRef = useRef<HTMLDivElement>(null)
    const generatedLabelId = useId()
    const onChange = useCallback((nextValue: string) => {
        props.onChange?.(nextValue)
        window.requestAnimationFrame(() => {
            const slots = regionRef.current?.querySelectorAll<HTMLElement>("[data-slot='input-otp-slot']")
            if (!slots?.length) return
            const activeIndex = Math.min(nextValue.length, slots.length - 1)
            slots.item(activeIndex).scrollIntoView({ block: "nearest", inline: "nearest" })
        })
    }, [props.onChange])

    const labelId = props.label === undefined ? props.labelledBy : generatedLabelId
    const control = (
        <HorizontalScrollRegion
            ref={regionRef}
            className={horizontalScrollRegionClassName}
            data-contract="PADDING-1 OVERFLOW-3 OVERFLOW-5"
            isFocusable={false}
            {...(labelId === undefined ? {} : { role: "group", "aria-labelledby": labelId })}
        >
            <InputOTP
                id={props.id}
                name={props.name}
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                autoComplete="one-time-code"
                inputMode="numeric"
                defaultValue={props.defaultValue}
                isDisabled={props.disabled === true}
                isInvalid={props.invalid === true}
                aria-invalid={props.invalid === true ? true : undefined}
                aria-describedby={props.describedBy}
                {...(labelId === undefined ? {} : { "aria-labelledby": labelId })}
                variant="secondary"
                onChange={onChange}
            >
                <InputOTP.Group>
                    {Array.from({ length: 6 }, (_, index) => (
                        <InputOTP.Slot key={index} index={index} />
                    ))}
                </InputOTP.Group>
            </InputOTP>
        </HorizontalScrollRegion>
    )

    if (props.label === undefined) return control
    return (
        <div className="starci-core-otp-field" data-grammar-otp-field="true">
            <HeroLabel
                className={props.isLabelHidden === true ? "starci-core-visually-hidden" : "starci-core-otp-label"}
                htmlFor={props.id}
                id={labelId}
            >
                {props.label}
            </HeroLabel>
            {control}
        </div>
    )
}
