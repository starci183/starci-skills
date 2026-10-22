import { Button, Form, SectionHeader, Text } from "@starci/grammar/common"
import { FormInput } from "@/components/composites/FormInput"
import type { FormInputField, FormInputSpec } from "@/components/composites/FormInput"

/** Copy, fields, state and actions supplied by the connected sign-in block. */
export interface SignInFormBaseProps {
    readonly state: "ready" | "working" | "failed"
    readonly props: {
        readonly title: string
        readonly submitLabel: string
        readonly failure: string | undefined
        readonly email: FormInputField
        readonly password: FormInputField
    }
    readonly on: {
        readonly submit: () => void
        readonly emailChange: (value: string) => void
        readonly emailBlur: () => void
        readonly passwordChange: (value: string) => void
        readonly passwordBlur: () => void
    }
}

/** The email input of the sign-in form. */
const EMAIL: FormInputSpec = { id: "sign-in-email", name: "email", kind: "email" }

/** The password input of the sign-in form. */
const PASSWORD: FormInputSpec = { id: "sign-in-password", name: "password", kind: "password" }

/** Draws the sign-in form without reading navigation, copy or session state. */
export const SignInFormBase = (props: SignInFormBaseProps) => (
    <>
        <SectionHeader title={props.props.title} level={2} />
        <Form label={props.props.title} isPending={props.state === "working"} onSubmit={props.on.submit}>
            <FormInput
                input={EMAIL}
                field={props.props.email}
                onChange={props.on.emailChange}
                onBlur={props.on.emailBlur}
            />
            <FormInput
                input={PASSWORD}
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
