"use client"

import { useController } from "react-hook-form"
import type { Control, FieldValues, Path } from "react-hook-form"

/** One controlled field of a form as a grammar Input takes it: its value and error, and its change and blur handlers. */
export interface FormFieldBinding {
    readonly state: { readonly value: string; readonly errorMessage?: string }
    readonly on: { readonly change: (value: string) => void; readonly blur: () => void }
}

/** Binds one text field of a react-hook-form form; a value that is not text yet reads as empty. */
export const useFormField = <TValues extends FieldValues>(
    control: Control<TValues>,
    name: Path<TValues>,
): FormFieldBinding => {
    const { field, fieldState } = useController({ control, name })
    const value: unknown = field.value
    return {
        state: { value: typeof value === "string" ? value : "", errorMessage: fieldState.error?.message },
        on: { change: field.onChange, blur: field.onBlur },
    }
}
