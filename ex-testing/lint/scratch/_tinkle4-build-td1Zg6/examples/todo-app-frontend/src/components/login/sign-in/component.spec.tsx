import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { SignInScreenView, type SignInScreenViewCopy } from "./component"
import { SIGN_IN_DESTINATIONS } from "./destinations"

const noop = () => {}

/** The English copy the connected half would resolve for an `en` reader; the view draws what it is given. */
const copy: SignInScreenViewCopy = {
    brand: "Todo app",
    welcomeHeading: "A steady start.",
    welcomeTagline: "One task at a time.",
    formHeading: "Welcome back",
    formTagline: "Sign in to keep your tasks moving.",
    cardLabel: "Sign in",
    emailLabel: "Email",
    passwordLabel: "Password",
    forgotPassword: "Forgot password?",
    submit: "Sign in",
    submitting: "Signing in...",
    helperEmpty: "Enter your email and password to continue.",
    helperPassword: "Enter your password to continue.",
    helperEmail: "Enter your email to continue.",
    newHere: "New here?",
    createAccount: "Create an account",
    privacyPolicy: "Privacy policy",
    terms: "Terms",
}

describe("SignInScreenView", () => {
    it("ui.login.sign-in: empty state has no values, a disabled submit and explicit guidance", () => {
        render(
            <SignInScreenView
                state="empty"
                email=""
                password=""
                refusal={null}
                copy={copy}
                onEmailChange={noop}
                onPasswordChange={noop}
                onSubmit={noop}
            />,
        )
        expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled()
        expect(screen.getByText("Enter your email and password to continue.")).toBeInTheDocument()
    })

    it("ui.login.sign-in: filled state enables submit once both fields hold a value", () => {
        render(
            <SignInScreenView
                state="filled"
                email="a@b.com"
                password="x"
                refusal={null}
                copy={copy}
                onEmailChange={noop}
                onPasswordChange={noop}
                onSubmit={noop}
            />,
        )
        expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled()
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it("ui.login.sign-in: working state disables the form while submitting", () => {
        render(
            <SignInScreenView
                state="working"
                email="a@b.com"
                password="x"
                refusal={null}
                copy={copy}
                onEmailChange={noop}
                onPasswordChange={noop}
                onSubmit={noop}
            />,
        )
        expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled()
    })

    it("ac.login.password.sign-in.refusal-does-not-name-the-half: refused state carries one message regardless of which half was wrong", () => {
        const message = "That email and password do not match."
        render(
            <SignInScreenView
                state="refused"
                email="a@b.com"
                password=""
                refusal={message}
                copy={copy}
                onEmailChange={noop}
                onPasswordChange={noop}
                onSubmit={noop}
            />,
        )
        expect(screen.getByRole("alert")).toHaveTextContent(message)
        expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled()
        expect(screen.getByText("Enter your password to continue.")).toBeInTheDocument()
    })

    it("ac.login.password.sign-in.wrong-pair-is-refused: submitting calls onSubmit exactly once", () => {
        const onSubmit = vi.fn()
        render(
            <SignInScreenView
                state="filled"
                email="a@b.com"
                password="x"
                refusal={null}
                copy={copy}
                onEmailChange={noop}
                onPasswordChange={noop}
                onSubmit={onSubmit}
            />,
        )
        screen.getByRole("button", { name: "Sign in" }).click()
        expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it("ui.login.sign-in: the direction furniture is all real - welcome panel, turtle, form and destinations", () => {
        render(
            <SignInScreenView
                state="empty"
                email=""
                password=""
                refusal={null}
                copy={copy}
                onEmailChange={noop}
                onPasswordChange={noop}
                onSubmit={noop}
            />,
        )
        expect(screen.getByRole("heading", { name: "A steady start." })).toBeInTheDocument()
        expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument()
        expect(screen.getByText("Todo app")).toBeInTheDocument()
        expect(document.querySelector("main img[src=\"/sign-in/turtle-master.png\"]")).toHaveAttribute("alt", "")
        expect(screen.getByLabelText("Email")).toBeInTheDocument()
        expect(screen.getByLabelText("Password")).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", SIGN_IN_DESTINATIONS.forgotPassword)
        expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", SIGN_IN_DESTINATIONS.createAccount)
        expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", SIGN_IN_DESTINATIONS.privacyPolicy)
        expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", SIGN_IN_DESTINATIONS.terms)
    })
})
