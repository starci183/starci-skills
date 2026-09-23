"use client"

import {
    Description as HeroDescription,
    FieldError as HeroFieldError,
    Label as HeroLabel,
} from "@heroui/react"
import { useCallback, useId, useState, type ReactNode } from "react"
import type { PresentationState } from "../../../common/state.js"

/**
 * The one field contract every Grammar form control shares.
 *
 * A control owns its label, its guidance and its validation copy, so a reader never meets a control
 * whose error is painted somewhere the screen reader cannot find. Every form control in the package
 * takes these props, renders the same label / description / error anatomy, and stamps the same
 * `data-grammar-*` state hooks on its root, so a visual family targets one vocabulary instead of one
 * per vendor part.
 */
export type FieldControlProps = {
    /** The visible accessible name. Required: a placeholder is never a name. */
    readonly label: ReactNode
    /** Keeps the label for assistive technology only; the name stays in the accessibility tree. */
    readonly isLabelHidden?: boolean
    /** Guidance the control's `aria-describedby` points at. */
    readonly description?: ReactNode
    /** Validation copy. Supplying it marks the control invalid, the same rule `Input` follows. */
    readonly errorMessage?: ReactNode
    readonly isInvalid?: boolean
    readonly isRequired?: boolean
    readonly isDisabled?: boolean
    readonly isReadOnly?: boolean
    /** The form field name submitted with the value. */
    readonly name?: string
}

export type FieldStateInput = {
    readonly isInvalid?: boolean | undefined
    readonly isDisabled?: boolean | undefined
    readonly isReadOnly?: boolean | undefined
    readonly isRequired?: boolean | undefined
    readonly isPending?: boolean | undefined
}

/** Folds the control's state into the render-neutral presentation vocabulary. */
export const fieldPresentationState = ({ isInvalid, isDisabled, isPending }: FieldStateInput): PresentationState => {
    if (isDisabled === true) return "unavailable"
    if (isPending === true) return "pending"
    if (isInvalid === true) return "negative"
    return "neutral"
}

const flag = (value: boolean | undefined) => (value === true ? "true" : "false")

/** The state hooks every form control root carries. Families read these, never vendor internals. */
export const fieldStateAttributes = (state: FieldStateInput) => ({
    "data-grammar-field": "true",
    "data-grammar-field-state": fieldPresentationState(state),
    "data-grammar-invalid": flag(state.isInvalid),
    "data-grammar-disabled": flag(state.isDisabled),
    "data-grammar-readonly": flag(state.isReadOnly),
    "data-grammar-required": flag(state.isRequired),
    "data-grammar-pending": flag(state.isPending),
}) as const

/** A control is invalid when it says so or when it carries validation copy. */
export const isFieldInvalid = ({ isInvalid, errorMessage }: {
    readonly isInvalid?: boolean | undefined
    readonly errorMessage?: ReactNode
}) =>
    isInvalid === true || errorMessage != null

const labelClassName = (isHidden: boolean | undefined) =>
    isHidden === true ? "starci-core-field-label starci-core-form-label--screen-reader" : "starci-core-field-label"

/** Label wired through the vendor's field context, so the control is named without an id handshake. */
export const FieldLabel = ({ children, isHidden, isRequired }: {
    readonly children: ReactNode
    readonly isHidden?: boolean | undefined
    readonly isRequired?: boolean | undefined
}) => (
    <HeroLabel
        className={labelClassName(isHidden)}
        data-grammar-field-label="true"
        {...(isRequired === true ? { isRequired: true } : {})}
    >
        {children}
    </HeroLabel>
)

/** Description slot; the vendor wires it into the control's `aria-describedby`. */
export const FieldDescription = ({ children }: { readonly children?: ReactNode }) => (children == null ? null : (
    <HeroDescription className="starci-core-field-description" data-grammar-field-description="true">
        {children}
    </HeroDescription>
))

/**
 * Error slot. It shows the supplied copy, or - when none is supplied - the messages the control's
 * own validation produced (a required value, a native constraint, a Form `validationErrors` entry),
 * and is referenced by the control's `aria-describedby` only while the control is invalid.
 */
export const FieldErrorText = ({ children }: { readonly children?: ReactNode }) => (
    <HeroFieldError className="starci-core-field-error" data-grammar-field-error="true" data-contract="FEEDBACK-1">
        {(validation) => children ?? validation.validationErrors.join(" ")}
    </HeroFieldError>
)

/** The shared anatomy props every vendor field root gets. */
export const vendorFieldProps = (props: FieldControlProps & { readonly isPending?: boolean | undefined }) => {
    const invalid = isFieldInvalid(props)
    // Only a true state is stated: an explicit `false` would override what a Fieldset (disabled) or a
    // Form (`validationErrors`) hands the control through the vendor's context.
    return {
        ...(invalid ? { isInvalid: true } : {}),
        ...(props.isDisabled === true ? { isDisabled: true } : {}),
        ...(props.isRequired === true ? { isRequired: true } : {}),
        ...(props.name === undefined ? {} : { name: props.name }),
        ...fieldStateAttributes({
            isInvalid: invalid,
            isDisabled: props.isDisabled,
            isReadOnly: props.isReadOnly,
            isRequired: props.isRequired,
            isPending: props.isPending,
        }),
    }
}

/**
 * Keeps a control's popover inside the Grammar root it was rendered in.
 *
 * The vendor portals popovers to `document.body`, which is outside `.grammar-common-root`: the
 * family's scoped variables (accent, field paint, radii) and scoped rules would not reach the open
 * list or calendar, so a Core or Offset Pop picker would open onto the vendor's default theme. The
 * anchor finds the nearest root once mounted and the popover portals there instead; with no root
 * (bare usage) nothing changes.
 */
export const useGrammarPortal = () => {
    const [container, setContainer] = useState<Element | undefined>(undefined)
    const anchor = useCallback((node: HTMLElement | null) => {
        setContainer(node?.closest(".grammar-common-root") ?? undefined)
    }, [])
    return {
        anchor: <span ref={anchor} hidden data-grammar-portal-anchor="true" />,
        portalProps: container === undefined ? {} : { UNSTABLE_portalContainer: container },
    }
}

/** What `Field` hands the control it wraps: the id and ARIA wiring for a native or custom control. */
export type FieldControlAttributes = {
    readonly id: string
    readonly name?: string
    readonly "aria-describedby"?: string
    readonly "aria-invalid"?: true
    readonly "aria-required"?: true
    readonly required?: true
    readonly disabled?: true
    readonly readOnly?: true
}

export type FieldProps = FieldControlProps & {
    /** Control id. Generated when omitted. */
    readonly id?: string
    /** Renders the control with the attributes that bind it to this field's label, guidance and error. */
    readonly children: (control: FieldControlAttributes) => ReactNode
}

/**
 * Label + description + error for ANY control: a native element, a third-party widget, or an app's
 * own input. Grammar's own form controls already render this anatomy; `Field` is the same anatomy
 * for everything else, with the id and `aria-describedby` / `aria-invalid` wiring handed to the
 * control so a custom control is announced exactly like a Grammar one.
 */
export const Field = ({
    id: idProp,
    label,
    isLabelHidden,
    description,
    errorMessage,
    isInvalid,
    isRequired,
    isDisabled,
    isReadOnly,
    name,
    children,
}: FieldProps) => {
    const generated = useId()
    const id = idProp ?? `field${generated.replace(/:/g, "")}`
    const invalid = isFieldInvalid({ isInvalid, errorMessage })
    const descriptionId = description == null ? undefined : `${id}-description`
    const errorId = invalid && errorMessage != null ? `${id}-error` : undefined
    const describedBy = [descriptionId, errorId].filter((part) => part !== undefined).join(" ")

    return (
        <div
            data-tier="atom"
            data-component="Field"
            data-contract="A11Y-1 FIELD-1 FIELD-2"
            className="starci-core-field"
            {...fieldStateAttributes({ isInvalid: invalid, isDisabled, isReadOnly, isRequired })}
        >
            <label
                htmlFor={id}
                className={labelClassName(isLabelHidden)}
                data-grammar-field-label="true"
                data-required={isRequired === true ? "true" : undefined}
            >
                {label}
                {isRequired === true ? <span aria-hidden="true" className="starci-core-field-required">*</span> : null}
            </label>
            {description == null ? null : (
                <span id={descriptionId} className="starci-core-field-description" data-grammar-field-description="true">
                    {description}
                </span>
            )}
            <div className="starci-core-field-control" data-grammar-field-control="true">
                {children({
                    id,
                    ...(name === undefined ? {} : { name }),
                    ...(describedBy === "" ? {} : { "aria-describedby": describedBy }),
                    ...(invalid ? { "aria-invalid": true } : {}),
                    ...(isRequired === true ? { "aria-required": true, required: true } : {}),
                    ...(isDisabled === true ? { disabled: true } : {}),
                    ...(isReadOnly === true ? { readOnly: true } : {}),
                })}
            </div>
            {errorId === undefined ? null : (
                <span id={errorId} className="starci-core-field-error" data-grammar-field-error="true" data-contract="FEEDBACK-1">
                    {errorMessage}
                </span>
            )}
        </div>
    )
}
