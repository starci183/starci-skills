"use client"

import { Form as HeroForm } from "@heroui/react"
import type { FormEvent, ReactNode } from "react"
import { fieldPresentationState } from "../../primitive/Field/index.js"

/** Server-side errors keyed by field `name`; each named control shows its own. */
export type FormValidationErrors = Readonly<Record<string, string | ReadonlyArray<string>>>

export type FormProps = {
    readonly children: ReactNode
    /** Accessible name; gives the form the `form` landmark role. */
    readonly label?: string
    readonly id?: string
    /**
     * Client submit. The browser navigation is prevented and the values arrive as `FormData`.
     * Omit it and pass `action` for a native submit.
     */
    readonly onSubmit?: (data: FormData, event: FormEvent<HTMLFormElement>) => void
    readonly onReset?: () => void
    readonly action?: string
    readonly method?: "get" | "post"
    readonly validationErrors?: FormValidationErrors
    /**
     * `native` (default) blocks submit and focuses the first invalid control; `aria` marks controls
     * invalid in real time and lets the submit through for the app to decide.
     */
    readonly validationBehavior?: "native" | "aria"
    /** A submit is in flight: the form announces busy and ignores another submit. */
    readonly isPending?: boolean
}

/**
 * The form boundary. Controls inside validate on submit (native constraint validation, required
 * values, and any `validationErrors` from the server matched by field name) and show the message in
 * their own error slot; the first invalid control receives focus.
 */
export const Form = ({
    children,
    label,
    id,
    onSubmit,
    onReset,
    action,
    method,
    validationErrors,
    validationBehavior = "native",
    isPending = false,
}: FormProps) => {
    const errors = validationErrors === undefined
        ? undefined
        : Object.fromEntries(Object.entries(validationErrors).map(([key, value]) => [key, typeof value === "string" ? value : [...value]]))

    return (
        <HeroForm
            data-tier="composite"
            data-component="Form"
            data-contract="FEEDBACK-1 ACTION-1 ACTION-2"
            data-grammar-pending={isPending ? "true" : "false"}
            data-grammar-field-state={fieldPresentationState({ isPending })}
            className="starci-core-form"
            validationBehavior={validationBehavior}
            {...(label === undefined ? {} : { "aria-label": label })}
            {...(id === undefined ? {} : { id })}
            {...(action === undefined ? {} : { action })}
            {...(method === undefined ? {} : { method })}
            {...(errors === undefined ? {} : { validationErrors: errors })}
            {...(isPending ? { "aria-busy": true } : {})}
            {...(onReset === undefined ? {} : { onReset: () => onReset() })}
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
                if (isPending) {
                    event.preventDefault()
                    return
                }
                if (onSubmit === undefined) return
                event.preventDefault()
                onSubmit(new FormData(event.currentTarget), event)
            }}
        >
            {children}
        </HeroForm>
    )
}
