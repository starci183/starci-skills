"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useSignIn } from "@/hooks/auth"
import { SignInScreenView } from "./component"

/**
 * The connected owner of ui.login.sign-in: it holds the two field values as intrinsic form state,
 * hands the submit lifecycle to useSignIn (session/world), resolves the one state SignInScreenView
 * renders, and hands every render path to the pure SignInScreenView in ./component.tsx, which is the
 * only place that decides what the four states look like. The password is cleared once a submit
 * settles, because ui.login.sign-in's refused state keeps the email but asks for the password again;
 * a successful submit navigates away before the cleared value is ever seen.
 */
export const SignInScreenBlock = () => {
    const tSignIn = useTranslations("signIn")
    const tShell = useTranslations("shell")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const { submitting, refusal, credentialsRefused, submit } = useSignIn()

    /* The transport collapses every refused sign-in into one message; that one is the dictionary's
     * to translate. Anything else is a reason the dictionaries never claimed, so it is shown as it
     * arrived rather than mislabeled as a bad password. */
    const refusalCopy = refusal === null ? null : credentialsRefused ? tSignIn("refusal") : refusal

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
