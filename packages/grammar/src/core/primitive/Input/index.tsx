"use client"

import { useEffect, useState, type ComponentType, type ReactNode } from "react"
import {
    Description as HeroDescription,
    ErrorMessage as HeroErrorMessage,
    Input as HeroInput,
    Label as HeroLabel,
    Skeleton as HeroSkeleton,
    TextField as HeroTextField,
} from "@heroui/react"
import { Button } from "../Button/index.js"

export type InputKind = "email" | "tel" | "password" | "newPassword" | "code" | "text"
export type InputVariant = "primary" | "secondary"

type InputIcon = ComponentType<{ readonly className?: string }>

export type InputProps = {
    readonly id: string
    readonly name: string
    readonly label: ReactNode
    readonly kind?: InputKind
    readonly variant?: InputVariant
    readonly placeholder?: string
    readonly defaultValue?: string
    readonly value?: string
    readonly hint?: ReactNode
    readonly errorMessage?: ReactNode
    readonly isError?: boolean
    readonly isDisabled?: boolean
    readonly isRequired?: boolean
    readonly isSkeleton?: boolean
    /** The value can be focused, selected and copied but not changed (unlike `isDisabled`, it stays at full contrast). */
    readonly isReadOnly?: boolean
    /** Adds a copy action after the control that copies the current value; needs `copyLabel` (and `copiedLabel` for the confirmation). */
    readonly isCopyable?: boolean
    readonly copyLabel?: string
    /** Shown on the copy action for a moment after a successful copy. */
    readonly copiedLabel?: string
    /** Called with the copied value after it reached the clipboard. */
    readonly onCopy?: (value: string) => void
    readonly revealLabel?: string
    readonly hideLabel?: string
    readonly revealIcon?: InputIcon
    readonly hideIcon?: InputIcon
    readonly onValueChange?: (value: string) => void
}

const KINDS = {
    email: { type: "email", autoComplete: "email", inputMode: "email" },
    tel: { type: "tel", autoComplete: "tel", inputMode: "tel" },
    password: { type: "password", autoComplete: "current-password", inputMode: "text" },
    newPassword: { type: "password", autoComplete: "new-password", inputMode: "text" },
    code: { type: "text", autoComplete: "one-time-code", inputMode: "numeric" },
    text: { type: "text", autoComplete: "off", inputMode: "text" },
} as const

/** Core ownership boundary for label, guidance, control state, and validation copy. */
export const Input = ({
    id,
    name,
    label,
    kind: kindName = "text",
    variant = "primary",
    placeholder,
    defaultValue,
    value,
    hint,
    errorMessage,
    isError = false,
    isDisabled = false,
    isRequired = false,
    isSkeleton = false,
    isReadOnly = false,
    isCopyable = false,
    copyLabel,
    copiedLabel,
    onCopy,
    revealLabel,
    hideLabel,
    revealIcon: RevealIcon,
    hideIcon: HideIcon,
    onValueChange,
}: InputProps) => {
    const [isRevealed, setIsRevealed] = useState(false)
    const kind = KINDS[kindName]
    const isSecret = kindName === "password" || kindName === "newPassword"
    const invalid = isError || errorMessage != null
    const toggleLabel = isRevealed ? hideLabel : revealLabel
    const ToggleIcon = isRevealed ? HideIcon : RevealIcon
    const [isCopied, setIsCopied] = useState(false)
    const canCopy = isCopyable && copyLabel !== undefined

    useEffect(() => {
        if (!isCopied) return
        const timer = setTimeout(() => setIsCopied(false), 2000)
        return () => clearTimeout(timer)
    }, [isCopied])

    /**
     * Copies what the control holds now (controlled or not); when the clipboard is refused, the value is selected instead.
     * The control is found by its id because the vendor input does not forward a ref.
     */
    const copy = async () => {
        const field = document.getElementById(id)
        const control = field instanceof HTMLInputElement ? field : null
        const current = control?.value ?? value ?? ""
        try {
            await navigator.clipboard.writeText(current)
            setIsCopied(true)
            onCopy?.(current)
        } catch {
            control?.select()
        }
    }

    if (isSkeleton) {
        return (
            <div data-tier="atom" data-component="Input" data-state="skeleton" data-contract="GAP-2" className="starci-core-input">
                <HeroSkeleton className="starci-core-input-resting-label" />
                <HeroSkeleton className="starci-core-input-resting-control" />
            </div>
        )
    }

    return (
        <HeroTextField
            data-tier="atom"
            data-component="Input"
            fullWidth
            variant={variant}
            data-grammar-variant={variant}
            isInvalid={invalid}
            isDisabled={isDisabled}
            isRequired={isRequired}
            isReadOnly={isReadOnly}
            {...(value === undefined
                ? defaultValue === undefined ? {} : { defaultValue }
                : { value })}
            onChange={(next: string) => onValueChange?.(next)}
            data-grammar-readonly={isReadOnly ? "true" : "false"}
            data-contract="GAP-2"
            className="starci-core-input"
        >
            <HeroLabel>{label}</HeroLabel>
            {hint == null ? null : <HeroDescription>{hint}</HeroDescription>}
            <div className="starci-core-input-row" data-copyable={canCopy ? "true" : "false"}>
                <div className="starci-core-input-control" data-reveal={isSecret && toggleLabel !== undefined ? "true" : "false"}>
                    <HeroInput
                        id={id}
                        name={name}
                        type={isSecret && isRevealed ? "text" : kind.type}
                        autoComplete={kind.autoComplete}
                        inputMode={kind.inputMode}
                        {...(placeholder === undefined ? {} : { placeholder })}
                        fullWidth
                        className="starci-core-input-field"
                    />
                    {!isSecret || toggleLabel === undefined ? null : (
                        <button
                            type="button"
                            aria-label={toggleLabel}
                            disabled={isDisabled}
                            data-contract="TONE-2"
                            className="starci-core-input-reveal"
                            onClick={() => setIsRevealed((current) => !current)}
                        >
                            {ToggleIcon === undefined ? <span data-contract="FONT-1" className="starci-core-input-reveal-label">{toggleLabel}</span> : <ToggleIcon className="starci-core-input-reveal-icon" />}
                        </button>
                    )}
                </div>
                {canCopy ? (
                    <Button variant="outline" isDisabled={isDisabled} onPress={() => void copy()}>
                        <span aria-live="polite">{isCopied && copiedLabel !== undefined ? copiedLabel : copyLabel}</span>
                    </Button>
                ) : null}
            </div>
            {errorMessage == null ? null : <HeroErrorMessage>{errorMessage}</HeroErrorMessage>}
        </HeroTextField>
    )
}
