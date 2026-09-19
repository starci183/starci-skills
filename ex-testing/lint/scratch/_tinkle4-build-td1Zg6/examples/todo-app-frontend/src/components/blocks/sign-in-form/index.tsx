"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { SIGN_IN_REFUSAL_MESSAGE } from "@/modules/api/auth"
import { useSignIn } from "@/hooks/auth"
import { SignInFormView } from "./component"

/** SignInFormBlock takes no external props; the session and field state are entirely its own. */
export type SignInFormBlockProps = Record<never, never>

/**
 * The connected owner of ui.login.sign-in: it holds the two field values as intrinsic form state, hands
 * the submit lifecycle to useSignIn (session/world), resolves the one state SignInFormView renders, and
 * hands every render path to the pure SignInFormView in ./component.tsx, which is the only place that
 * decides what the four states look like.
 */
export const SignInFormBlock = (props: SignInFormBlockProps) => {
    void props
    const t = useTranslations("signIn")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const { submitting, refusal, submit } = useSignIn()

    /* The transport collapses every refused sign-in into one message; that one is the dictionary's
     * to translate. Anything else is a reason the dictionaries never claimed, so it is shown as it
     * arrived rather than mislabeled as a bad password. */
    const refusalCopy = refusal === null ? null : refusal === SIGN_IN_REFUSAL_MESSAGE ? t("refusal") : refusal

    return (
        <SignInFormView
            state={refusal ? "refused" : submitting ? "working" : email || password ? "filled" : "empty"}
            email={email}
            password={password}
            refusal={refusalCopy}
            copy={{
                cardLabel: t("title"),
                emailLabel: t("email"),
                passwordLabel: t("password"),
                submit: t("submit"),
                submitting: t("submitting"),
            }}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={() => submit(email, password)}
        />
    )
}
