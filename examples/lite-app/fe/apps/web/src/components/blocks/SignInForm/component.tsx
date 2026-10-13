import { Button, Form, Input, SectionHeader, Text } from "@starci/grammar/common"
import type { InputKind } from "@starci/grammar/common"

/** One controlled field as data: its value and its validation message. */
interface SignInFieldState {
    readonly value: string
    readonly errorMessage?: string
}

/** Copy, fields, state and actions supplied by the connected sign-in block. */
export interface SignInFormBaseProps {
    readonly state: "ready" | "working" | "failed"
    readonly props: {
        readonly title: string
        readonly emailLabel: string
        readonly passwordLabel: string
        readonly submitLabel: string
        readonly failure?: string
        readonly email: SignInFieldState
        readonly password: SignInFieldState
    }
    readonly on: {
        readonly submit: () => void
        readonly emailChange: (value: string) => void
        readonly emailBlur: () => void
        readonly passwordChange: (value: string) => void
        readonly passwordBlur: () => void
    }
}

/** What one controlled credential input takes. */
interface SignInInputProps {
    readonly id: string
    readonly name: string
    readonly label: string
    readonly kind: InputKind
    readonly field: SignInFieldState
    readonly onChange: (value: string) => void
    readonly onBlur: () => void
}

/** One controlled grammar Input of the sign-in form. */
const SignInInput = (props: SignInInputProps) => (
    <Input
        id={props.id}
        name={props.name}
        label={props.label}
        kind={props.kind}
        isRequired
        value={props.field.value}
        onValueChange={props.onChange}
        onBlur={props.onBlur}
        errorMessage={props.field.errorMessage}
        isError={props.field.errorMessage !== undefined}
    />
)

/** Draws the sign-in form without reading navigation, copy or session state. */
export const SignInFormBase = (props: SignInFormBaseProps) => (
    <>
        <SectionHeader title={props.props.title} level={2} />
        <Form label={props.props.title} isPending={props.state === "working"} onSubmit={props.on.submit}>
            <SignInInput
                id="sign-in-email"
                name="email"
                label={props.props.emailLabel}
                kind="email"
                field={props.props.email}
                onChange={props.on.emailChange}
                onBlur={props.on.emailBlur}
            />
            <SignInInput
                id="sign-in-password"
                name="password"
                label={props.props.passwordLabel}
                kind="password"
                field={props.props.password}
                onChange={props.on.passwordChange}
                onBlur={props.on.passwordBlur}
            />
            {props.props.failure === undefined ? null : <Text live="assertive">{props.props.failure}</Text>}
            <Button type="submit" variant="primary" isPending={props.state === "working"}>
                {props.props.submitLabel}
            </Button>
        </Form>
    </>
)
