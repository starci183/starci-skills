import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { SessionFormBase, type SessionFormProps, type SessionFormState } from "./component"

const signInCopy = {
    title: "Welcome back",
    intro: "Sign in to your Northwind account.",
    emailLabel: "Email",
    passwordLabel: "Password",
    passwordHint: null,
    submit: "Sign in",
    submitting: "Signing in...",
    switchMode: "New here? Create an account",
    backToBrowse: "Back to browse",
}

const registerCopy = {
    ...signInCopy,
    title: "Create your account",
    intro: "Register an email and a password to start ordering.",
    passwordHint: "At least 8 characters.",
    submit: "Create account",
    submitting: "Creating account...",
    switchMode: "Already registered? Sign in",
}

const surfaceFor = (
    state: SessionFormState,
    overrides: Partial<SessionFormProps["props"]> = {},
    on: Partial<SessionFormProps["on"]> = {},
): SessionFormProps => ({
    state,
    props: {
        mode: "sign-in",
        email: "",
        password: "",
        refusal: null,
        browseHref: "/en/browse",
        copy: signInCopy,
        ...overrides,
    },
    on: {
        onEmailChange: () => {},
        onPasswordChange: () => {},
        onSubmit: () => {},
        onSwitchMode: () => {},
        ...on,
    },
})

describe("SessionFormBase", () => {
    it("sign-in mode draws the welcome-back heading, the two labelled fields and the way out", () => {
        render(<SessionFormBase {...surfaceFor("empty")} />)

        expect(screen.getByRole("heading", { level: 2, name: "Welcome back" })).toBeInTheDocument()
        expect(screen.getByText("Sign in to your Northwind account.")).toBeInTheDocument()
        expect(screen.getByLabelText("Email")).toBeInTheDocument()
        expect(screen.getByLabelText("Password")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "New here? Create an account" })).toBeInTheDocument()
        expect(screen.getByRole("link", { name: "Back to browse" })).toHaveAttribute("href", "/en/browse")
    })

    it("empty: the submit is withheld before any credential check could run", () => {
        render(<SessionFormBase {...surfaceFor("empty")} />)

        expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled()
    })

    it("filled: a present pair lets the submit arm", () => {
        render(<SessionFormBase {...surfaceFor("filled", { email: "a@b.c", password: "xxxxxxxx" })} />)

        expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled()
    })

    it("refused: the one uniform refusal shows, and it names neither half", () => {
        render(<SessionFormBase {...surfaceFor("refused", { refusal: "That email and password do not match." })} />)

        expect(screen.getByText("That email and password do not match.")).toBeInTheDocument()
    })

    it("working: pending belongs to the press and blocks a duplicate", () => {
        render(<SessionFormBase {...surfaceFor("working", { email: "a@b.c", password: "xxxxxxxx" })} />)

        expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled()
    })

    it("register mode swaps the heading, the submit and the password semantics", () => {
        render(<SessionFormBase {...surfaceFor("empty", { mode: "register", copy: registerCopy })} />)

        expect(screen.getByRole("heading", { level: 2, name: "Create your account" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Already registered? Sign in" })).toBeInTheDocument()
        expect(screen.getByText("At least 8 characters.")).toBeInTheDocument()
        expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "new-password")
    })

    it("the mode toggle and the submit report upward", () => {
        const onSwitchMode = vi.fn()
        const onSubmit = vi.fn()
        render(
            <SessionFormBase
                {...surfaceFor("filled", { email: "a@b.c", password: "xxxxxxxx" }, { onSwitchMode, onSubmit })}
            />,
        )

        fireEvent.click(screen.getByRole("button", { name: "New here? Create an account" }))
        expect(onSwitchMode).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole("button", { name: "Sign in" }))
        expect(onSubmit).toHaveBeenCalledTimes(1)
    })
})
