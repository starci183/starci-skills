"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type ComponentType, type CSSProperties, type ReactNode } from "react"
import {
    Description as HeroDescription,
    ErrorMessage as HeroErrorMessage,
    Input as HeroInput,
    Label as HeroLabel,
    Skeleton as HeroSkeleton,
    TextField as HeroTextField,
} from "@heroui/react"

export type InputKind = "email" | "tel" | "password" | "newPassword" | "code" | "text"
export type InputVariant = "primary" | "secondary"

type InputIcon = ComponentType<{ readonly className?: string }>

export type InputProps = {
    readonly id: string
    readonly name: string
    readonly label: ReactNode
    /** Keeps the label as the accessible name but hides it visually (a row of inputs that label themselves by position). */
    readonly isLabelHidden?: boolean
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
    /**
     * Adds a copy action inside the field, at its end (after the reveal toggle of a secret), that copies the current value;
     * needs `copyLabel` (its accessible name, and its visible text when no `copyIcon` is given).
     */
    readonly isCopyable?: boolean
    readonly copyLabel?: string
    /** Announced (and shown, without `copiedIcon`) on the copy action for a moment after a successful copy. */
    readonly copiedLabel?: string
    readonly copyIcon?: InputIcon
    readonly copiedIcon?: InputIcon
    /** Called with the copied value after it reached the clipboard. */
    readonly onCopy?: (value: string) => void
    readonly revealLabel?: string
    readonly hideLabel?: string
    readonly revealIcon?: InputIcon
    readonly hideIcon?: InputIcon
    readonly onValueChange?: (value: string) => void
    /** Focus left the input itself (not an in-field action). Forwarded to the underlying input. */
    readonly onBlur?: () => void
    /** The native paste event of the input, before the value changes; `preventDefault()` keeps the vendor from inserting. */
    readonly onPaste?: (event: ClipboardEvent<HTMLInputElement>) => void
    /** Focuses the input when it mounts (a row that was just added, a drawer that just opened). */
    readonly autoFocus?: boolean
}

const KINDS = {
    email: { type: "email", autoComplete: "email", inputMode: "email" },
    tel: { type: "tel", autoComplete: "tel", inputMode: "tel" },
    password: { type: "password", autoComplete: "current-password", inputMode: "text" },
    newPassword: { type: "password", autoComplete: "new-password", inputMode: "text" },
    code: { type: "text", autoComplete: "one-time-code", inputMode: "numeric" },
    text: { type: "text", autoComplete: "off", inputMode: "text" },
} as const

/**
 * Core ownership boundary for label, guidance, control state, and validation copy.
 *
 * Layout: the field is a grid of label, hint, control box and error. The error message is the LAST row and reserves no
 * space until it exists, so showing or clearing it moves nothing above it: the control box keeps its position and height.
 * A row that puts a trailing action beside the field (an input and a Delete button) aligns that action to the control
 * box, not to the whole field: `[data-grammar-input-control="true"]` is the control box (the input and its in-field
 * actions). Give the row `align-items: start` and align the action to that box (offset by the label and hint above it),
 * so an error appearing under the field never shifts the action.
 */
export const Input = ({
    id,
    name,
    label,
    isLabelHidden = false,
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
    copyIcon: CopyIcon,
    copiedIcon: CopiedIcon,
    onCopy,
    revealLabel,
    hideLabel,
    revealIcon: RevealIcon,
    hideIcon: HideIcon,
    onValueChange,
    onBlur,
    onPaste,
    autoFocus = false,
}: InputProps) => {
    const [isRevealed, setIsRevealed] = useState(false)
    const kind = KINDS[kindName]
    const isSecret = kindName === "password" || kindName === "newPassword"
    const invalid = isError || errorMessage != null
    const toggleLabel = isRevealed ? hideLabel : revealLabel
    const ToggleIcon = isRevealed ? HideIcon : RevealIcon
    const [isCopied, setIsCopied] = useState(false)
    const canCopy = isCopyable && copyLabel !== undefined
    const canReveal = isSecret && toggleLabel !== undefined
    const copyName = isCopied && copiedLabel !== undefined ? copiedLabel : copyLabel
    const CopyGlyph = isCopied && CopiedIcon !== undefined ? CopiedIcon : CopyIcon
    // The in-field actions overlay the field's end; the field reserves exactly their measured width so the value never runs under them.
    const actions = useRef<HTMLSpanElement>(null)
    const [actionsWidth, setActionsWidth] = useState<number | null>(null)
    useLayoutEffect(() => {
        const node = actions.current
        if (node === null) return
        const measure = () => setActionsWidth(node.getBoundingClientRect().width)
        measure()
        if (typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
    }, [canCopy, canReveal])

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
                {isLabelHidden ? null : <HeroSkeleton className="starci-core-input-resting-label" />}
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
            <HeroLabel {...(isLabelHidden ? { className: "starci-core-form-label--screen-reader" } : {})}>{label}</HeroLabel>
            {hint == null ? null : <HeroDescription>{hint}</HeroDescription>}
            <div
                className="starci-core-input-control"
                data-grammar-input-control="true"
                data-reveal={canReveal ? "true" : "false"}
                data-copyable={canCopy ? "true" : "false"}
                style={actionsWidth === null ? undefined : ({ "--starci-core-input-actions-width": `${actionsWidth}px` } as CSSProperties)}
            >
                <HeroInput
                    id={id}
                    name={name}
                    type={isSecret && isRevealed ? "text" : kind.type}
                    autoComplete={kind.autoComplete}
                    inputMode={kind.inputMode}
                    {...(placeholder === undefined ? {} : { placeholder })}
                    fullWidth
                    className="starci-core-input-field"
                    {...(autoFocus ? { autoFocus: true } : {})}
                    {...(onBlur === undefined ? {} : { onBlur: () => onBlur() })}
                    {...(onPaste === undefined ? {} : { onPaste })}
                />
                {canReveal || canCopy ? (
                    <span ref={actions} className="starci-core-input-actions">
                        {canReveal ? (
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
                        ) : null}
                        {canCopy ? (
                            <button
                                type="button"
                                aria-label={copyName}
                                disabled={isDisabled}
                                data-contract="TONE-2"
                                data-copied={isCopied ? "true" : "false"}
                                className="starci-core-input-reveal starci-core-input-copy"
                                onClick={() => void copy()}
                            >
                                {CopyGlyph === undefined ? <span data-contract="FONT-1" className="starci-core-input-reveal-label">{copyName}</span> : <CopyGlyph className="starci-core-input-reveal-icon" />}
                            </button>
                        ) : null}
                        <span className="starci-core-input-live" aria-live="polite">{isCopied ? copiedLabel ?? "" : ""}</span>
                    </span>
                ) : null}
            </div>
            {errorMessage == null ? null : <HeroErrorMessage>{errorMessage}</HeroErrorMessage>}
        </HeroTextField>
    )
}
