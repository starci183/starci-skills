"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useSignIn } from "@/hooks/auth"
import { SignInScreenView } from "./component"

/** The sign-in screen takes nothing from its page: it owns its own form and submission state. */
type SignInScreenBlockProps = Record<never, never>

/**
 * The connected owner of ui.login.sign-in: it holds the two field values as intrinsic form state,
 * hands the submit lifecycle to useSignIn (session/world), resolves the one state SignInScreenView
 * renders, and hands every render path to the pure SignInScreenView in ./component.tsx, which is the
 * only place that decides what the four states look like. The password is cleared once a submit
 * settles, because ui.login.sign-in's refused state keeps the email but asks for the password again;
 * a successful submit navigates away before the cleared value is ever seen.
 */
export const SignInScreenBlock = (props: SignInScreenBlockProps) => {
    void props
    const tSignIn = useTranslations("signIn")
    const tShell = useTranslations("shell")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const { submitting, refusal, credentialsRefused, submit } = useSignIn()

    /* The transport collapses every refused sign-in into one message; that one is the dictionary's
     * to translate. Any other reason is one the dictionaries never claimed, so the screen says only
     * that the sign-in did not go through. */
    const refusalCopy = refusal === null ? null : credentialsRefused ? tSignIn("refusal") : tSignIn("unavailable")

    const onSubmit = () => {
        if (!email || !password) return
        void submit(email, password).then(() => {
            setPassword("")
        })
    }

    return (
        <SignInScreenView
            state={refusal ? "refused" : submitting ? "working" : email || password ? "filled" : "empty"}
            email={email}
            password={password}
            refusal={refusalCopy}
            copy={{
                brand: tShell("brand"),
                welcomeHeading: tSignIn("welcomeHeading"),
                welcomeTagline: tSignIn("welcomeTagline"),
                turtleAlt: tSignIn("turtleAlt"),
                formHeading: tSignIn("formHeading"),
                formTagline: tSignIn("formTagline"),
                cardLabel: tSignIn("title"),
                emailLabel: tSignIn("email"),
                passwordLabel: tSignIn("password"),
                forgotPassword: tSignIn("forgotPassword"),
                submit: tSignIn("submit"),
                submitting: tSignIn("submitting"),
                helperEmpty: tSignIn("helperEmpty"),
                helperPassword: tSignIn("helperPassword"),
                helperEmail: tSignIn("helperEmail"),
                newHere: tSignIn("newHere"),
                createAccount: tSignIn("createAccount"),
                privacyPolicy: tShell("legal.privacyPolicy"),
                terms: tShell("legal.terms"),
            }}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onSubmit={onSubmit}
        />
    )
}
