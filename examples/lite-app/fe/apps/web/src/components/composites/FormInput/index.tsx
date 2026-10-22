import { Input } from "@starci/grammar/common"
import type { InputKind } from "@starci/grammar/common"

/** What identifies one input of a form and how it reads: its id, its form name, its kind and its example value. */
export interface FormInputSpec {
    readonly id: string
    readonly name: string
    readonly kind?: InputKind
    readonly placeholder?: string
}

/** One controlled field as data: its label, its value and its validation message. */
export interface FormInputField {
    readonly label: string
    readonly value: string
    readonly errorMessage?: string
}

/** What one form input takes: its spec, its field state, and what it reports (a new value, the focus leaving it). */
interface FormInputProps {
    readonly input: FormInputSpec
    readonly field: FormInputField
    readonly onChange: (value: string) => void
    readonly onBlur: () => void
}

/** One required, controlled grammar Input of a react-hook-form field (hooks/rhf): its value, change, blur and error. */
export const FormInput = (props: FormInputProps) => (
    <Input
        id={props.input.id}
        name={props.input.name}
        {...(props.input.kind === undefined ? {} : { kind: props.input.kind })}
        {...(props.input.placeholder === undefined ? {} : { placeholder: props.input.placeholder })}
        label={props.field.label}
        isRequired
        value={props.field.value}
        onValueChange={props.onChange}
        onBlur={props.onBlur}
        {...(props.field.errorMessage === undefined ? {} : { errorMessage: props.field.errorMessage })}
        isError={props.field.errorMessage !== undefined}
    />
)
