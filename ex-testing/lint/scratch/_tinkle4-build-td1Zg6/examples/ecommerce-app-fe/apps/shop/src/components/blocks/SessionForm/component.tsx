"use client"

import type { FormEvent } from "react"
import { Button, Input, SectionHeader, Text, TextAction } from "@starci/grammar/common"
import { sessionFormClassNames } from "./classNames"

/** Which credential act the form is submitting: an existing pair, or a fresh registration. */
export type SessionFormMode = "sign-in" | "register"

/**
 * `ui.identity.sign-in`'s situations: empty, filled, refused, working. Every branch below is one
 * of those four names; there is no fifth rendering path and no attempt to say which half of the
 * pair was wrong when refused, because `br.identity.sign-in` must read identically for both
 * refusal causes.
 */
export type SessionFormState = "empty" | "filled" | "refused" | "working"

/** The one beside-it inventory the SessionFormState closed vocabulary is checked against. */
export const SESSION_FORM_STATES: ReadonlyArray<SessionFormState> = ["empty", "filled", "refused", "working"] as const

/** Every word the pure session form renders, resolved by the connected half for the active mode. */
export type SessionFormCopy = {
    /** The form region's heading - the "Welcome back" / "Create your account" of the direction. */
    readonly title: string
    /** The line under the heading. */
    readonly intro: string
    readonly emailLabel: string
    readonly passwordLabel: string
    /** The registration-mode password guidance; null in sign-in mode. */
    readonly passwordHint: string | null
    readonly submit: string
    readonly submitting: string
    /** The mode toggle's label. */
    readonly switchMode: string
    readonly backToBrowse: string
}

/** The pure session form's resolved inputs: the situation, the fields, and every word settled. */
export type SessionFormProps = {
    /** Whole-surface situations this form settles. */
    readonly state: SessionFormState
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly mode: SessionFormMode
        readonly email: string
        readonly password: string
        readonly refusal: string | null
        readonly browseHref: string
        readonly copy: SessionFormCopy
    }
    /** What the surface reports upward: the field edits, the submit, and the mode toggle. */
    readonly on: {
        readonly onEmailChange: (value: string) => void
        readonly onPasswordChange: (value: string) => void
        readonly onSubmit: () => void
        readonly onSwitchMode: () => void
    }
}

/**
 * The frameless form region of the account's anonymous surface: heading and intro, the two
 * labelled fields, one refusal line when refused, the full-width submit, then the mode toggle and
 * the way back to browsing. `kind="newPassword"` on the register half carries the browser's real
 * autocomplete semantics; the empty-half submit is refused by disabling the button before any
 * credential check could run.
 */
export const SessionFormBase = (props: SessionFormProps) => {
    const isWorking = props.state === "working"
    const disabled = isWorking || !(props.props.email && props.props.password)
    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        props.on.onSubmit()
    }
    return (
        <div className={sessionFormClassNames.frame}>
            <SectionHeader title={props.props.copy.title} description={props.props.copy.intro} level={2} />
            <form onSubmit={onSubmit} data-state={props.state} className={sessionFormClassNames.fields}>
                <Input
                    id="session-email"
                    name="email"
                    label={props.props.copy.emailLabel}
                    kind="email"
                    value={props.props.email}
                    isDisabled={isWorking}
                    isRequired
                    onValueChange={props.on.onEmailChange}
                />
                <Input
                    id="session-password"
                    name="password"
                    label={props.props.copy.passwordLabel}
                    kind={props.props.mode === "register" ? "newPassword" : "password"}
                    value={props.props.password}
                    hint={props.props.copy.passwordHint ?? undefined}
                    isDisabled={isWorking}
                    isRequired
                    onValueChange={props.on.onPasswordChange}
                />
                {props.state === "refused" ? <Text live="assertive">{props.props.refusal}</Text> : null}
                <Button type="submit" variant="primary" width="fill" isDisabled={disabled} isPending={isWorking}>
                    {isWorking ? props.props.copy.submitting : props.props.copy.submit}
                </Button>
            </form>
            <div className={sessionFormClassNames.foot}>
                <TextAction onPress={props.on.onSwitchMode} isDisabled={isWorking}>
                    {props.props.copy.switchMode}
                </TextAction>
                <TextAction href={props.props.browseHref}>{props.props.copy.backToBrowse}</TextAction>
            </div>
        </div>
    )
}
