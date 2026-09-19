import type { FormEvent } from "react"
import { Button, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { SIGN_IN_FORM_FIELDS_CLASS_NAME } from "./classNames"

/**
 * ui.login.sign-in states: empty, filled, refused, working. Every branch below is one of those four
 * names; there is no fifth rendering path and no attempt to say which half of the pair was wrong when
 * refused, because br.login.password.sign-in must read identically for both refusal causes. The connected
 * owner in ./index.tsx resolves which state applies and hands it down explicitly.
 */
export type SignInFormState = "empty" | "filled" | "refused" | "working";

/** The one beside-it inventory the SignInFormState closed vocabulary is checked against. */
export const SIGN_IN_FORM_STATES: ReadonlyArray<SignInFormState> = ["empty", "filled", "refused", "working"] as const

/** Every word the pure sign-in form renders, resolved by the connected half. */
export type SignInFormViewCopy = {
  /** The card's accessible name, which is also the screen's title. */
  readonly cardLabel: string;
  readonly emailLabel: string;
  readonly passwordLabel: string;
  readonly submit: string;
  readonly submitting: string;
};

/** The public props of the pure sign-in form view. */
export type SignInFormViewProps = {
  readonly state: SignInFormState;
  readonly email: string;
  readonly password: string;
  readonly refusal: string | null;
  readonly copy: SignInFormViewCopy;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onSubmit: () => void;
};

/** The pure render of ui.login.sign-in; every one of its four states is decided by the caller's
 * `state`, and every word it draws arrives resolved through `copy` - this half knows the situations,
 * never the sentences. */
export const SignInFormView = (props: SignInFormViewProps) => {
    const state = props.state
    const isWorking = state === "working"
    const disabled = isWorking || !(props.email && props.password)
    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        props.onSubmit()
    }
    return (
        <SurfaceCard ariaLabel={props.copy.cardLabel} measure="formCompact">
            <form onSubmit={onSubmit} data-state={state} className={SIGN_IN_FORM_FIELDS_CLASS_NAME}>
                <Input
                    id="sign-in-email"
                    name="email"
                    label={props.copy.emailLabel}
                    kind="email"
                    value={props.email}
                    isDisabled={isWorking}
                    onValueChange={props.onEmailChange}
                />
                <Input
                    id="sign-in-password"
                    name="password"
                    label={props.copy.passwordLabel}
                    kind="password"
                    value={props.password}
                    isDisabled={isWorking}
                    onValueChange={props.onPasswordChange}
                />
                {state === "refused" ? <Text live="assertive">{props.refusal}</Text> : null}
                <Button type="submit" variant="primary" width="fill" isDisabled={disabled} isPending={isWorking}>
                    {isWorking ? props.copy.submitting : props.copy.submit}
                </Button>
            </form>
        </SurfaceCard>
    )
}
