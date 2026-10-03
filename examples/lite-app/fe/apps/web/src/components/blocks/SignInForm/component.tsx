import { Button, Form, Input, SectionHeader, Text } from "@starci/grammar/common"

/** Copy, state and action supplied by the connected sign-in block. */
export interface SignInFormBaseProps {
    readonly state: "ready" | "working" | "failed"
    readonly props: {
        readonly title: string
        readonly emailLabel: string
        readonly passwordLabel: string
        readonly submitLabel: string
        readonly failure?: string
    }
    readonly on: { readonly submit: (input: FormData) => void }
}

/** Draws the sign-in form without reading navigation, copy or database state. */
export const SignInFormBase = (props: SignInFormBaseProps) => (
    <>
        <SectionHeader title={props.props.title} level={2} />
        <Form label={props.props.title} isPending={props.state === "working"} onSubmit={props.on.submit}>
            <Input id="sign-in-email" name="email" label={props.props.emailLabel} kind="email" isRequired />
            <Input id="sign-in-password" name="password" label={props.props.passwordLabel} kind="password" isRequired />
            {props.props.failure === undefined ? null : <Text live="assertive">{props.props.failure}</Text>}
            <Button type="submit" variant="primary" isPending={props.state === "working"}>
                {props.props.submitLabel}
            </Button>
        </Form>
    </>
)
