"use client"

import { useCallback, useRef } from "react"
import { InputOTP, REGEXP_ONLY_DIGITS } from "@heroui/react"
import { horizontalScrollRegionClassName } from "./classNames.js"
import { HorizontalScrollRegion } from "./composite/HorizontalScrollRegion/index.js"

export type OtpInputProps = {
    readonly id: string
    readonly name: string
    readonly defaultValue?: string
    readonly disabled?: boolean
    readonly invalid?: boolean
    readonly describedBy?: string
    readonly onChange?: (value: string) => void
}

/** Own the conventional six-digit OTP control and its intrinsic-width overflow treatment. */
export const OtpInput = (props: OtpInputProps) => {
    const regionRef = useRef<HTMLDivElement>(null)
    const onChange = useCallback((nextValue: string) => {
        props.onChange?.(nextValue)
        window.requestAnimationFrame(() => {
            const slots = regionRef.current?.querySelectorAll<HTMLElement>("[data-slot='input-otp-slot']")
            if (!slots?.length) return
            const activeIndex = Math.min(nextValue.length, slots.length - 1)
            slots.item(activeIndex).scrollIntoView({ block: "nearest", inline: "nearest" })
        })
    }, [props.onChange])

    return (
        <HorizontalScrollRegion ref={regionRef} className={horizontalScrollRegionClassName} data-contract="PADDING-1 OVERFLOW-3 OVERFLOW-5">
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
}
