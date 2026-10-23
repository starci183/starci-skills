import { randomUUID } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"
import { formMode, shows, signedOutAccount, typeInto, UatRun, yesNo } from "./uat-run"

/**
 * uat.identity.sign-in - the flow record's five steps walked one-to-one against the running product (the shop app and the
 * identity api of the dev stack), through `starci uat record` only (the browser config ignores uat-*.ts otherwise). A fresh
 * disposable person per run: the record's accounts.yaml names identity.full-app.demo, whose store registers a new synthetic
 * person through the product's register door; the example exposes no account deletion, so the row stays (the record's cleanup).
 */

const FLOW = "uat.identity.sign-in"

const toRegister = (page: Page) => formMode(page, "register")
const toSignIn = (page: Page) => formMode(page, "sign-in")
const openSignedOut = signedOutAccount

test(`${FLOW}: register, a uniform refusal, empty-password validation, a conflict, sign in again`, async ({
    page,
    baseURL,
}) => {
    test.setTimeout(240_000)
    const run = new UatRun(FLOW, "Register a pair, be refused alike on a wrong one, sign in")
    const tag = (process.env.UAT_RUN_ID ?? randomUUID()).toLowerCase().replace(/[^a-z0-9]/g, "")
    const email = `uat-person-${tag}@example.test`
    const password = `pw-${randomUUID()}`
    // The shop calls the identity GraphQL api from the browser (owner ruling 2026-10-13); every POST to it is a credential call.
    const identityCalls: Array<string> = []
    page.on("request", (request) => {
        if (
            request.method() === "POST" &&
            new URL(request.url()).pathname === "/graphql" &&
            request.postData()?.includes("signIn")
        )
            identityCalls.push(request.url())
    })

    await run.step(
        page,
        1,
        "register",
        "Register a new email and password pair for the disposable person.",
        async () => {
            await openSignedOut(page)
            await toRegister(page)
            await typeInto(page, "Email", email)
            await typeInto(page, "Password", password)
            await page.getByRole("button", { name: "Register", exact: true }).click()
            const pending = await shows(page, "Registering…", 3_000)
            const signedIn = await shows(page, `Signed in as ${email}.`)
            run.resource({
                action: "created",
                kind: "person",
                id: email,
                note: "registered through the product's register door for this run",
            })
            return [
                {
                    id: "loading",
                    expected: "yes",
                    observed: yesNo(pending || signedIn),
                    note: pending
                        ? "the submit showed its pending label while the identity api answered"
                        : "the session answered before the pending label could be read; the settled surface is the answer",
                },
                {
                    id: "completion",
                    expected: "yes",
                    observed: yesNo(signedIn),
                    note: signedIn
                        ? `the account page shows "Signed in as ${email}."`
                        : "the account page did not show the person signed in",
                },
            ]
        },
    )

    await run.step(page, 2, "wrong-password", "Submit the registered email with a wrong password.", async () => {
        await openSignedOut(page)
        await toSignIn(page)
        await typeInto(page, "Email", email)
        await typeInto(page, "Password", `${password}-wrong`)
        await page.getByRole("button", { name: "Sign in", exact: true }).click()
        const refusal = await shows(page, "That email and password did not open a session.")
        const namesHalf = await page.getByText(/wrong password|no such (email|account)|unknown email/i).count()
        return [
            {
                id: "errorFeedback",
                expected: "yes",
                observed: yesNo(refusal && namesHalf === 0),
                note: refusal
                    ? `one uniform refusal shows; it names neither half (${namesHalf} lines name one)`
                    : "no refusal line rendered",
            },
        ]
    })

    await run.step(page, 3, "empty-password", "Submit the sign-in form with the password left empty.", async () => {
        await openSignedOut(page)
        await toSignIn(page)
        await typeInto(page, "Email", email)
        await typeInto(page, "Password", "")
        const postsBefore = identityCalls.length
        const submit = page.getByRole("button", { name: "Sign in", exact: true })
        // The form holds the submit disabled while a field is empty; a submit it still offers must be refused with the message.
        const disabled = await submit.isDisabled()
        const invalid = disabled
            ? false
            : (await submit.click(), await shows(page, "Enter an email and a password to continue.", 5_000))
        const noCredentialCheck = identityCalls.length === postsBefore
        return [
            {
                id: "validation",
                expected: "yes",
                observed: yesNo((disabled || invalid) && noCredentialCheck),
                note: `${disabled ? "the form holds Sign in disabled while the password is empty" : invalid ? "the form says to enter an email and a password" : "the empty submit was not refused"}; ${noCredentialCheck ? "no call reached the identity api" : "a credential check ran"}`,
            },
        ]
    })

    await run.step(
        page,
        4,
        "register-conflict",
        "Register the same email again with a different password.",
        async () => {
            await openSignedOut(page)
            await toRegister(page)
            await typeInto(page, "Email", email)
            await typeInto(page, "Password", `${password}-other`)
            await page.getByRole("button", { name: "Register", exact: true }).click()
            const conflict = await shows(page, "That email already has an account — sign in instead.")
            await toSignIn(page)
            await typeInto(page, "Email", email)
            await typeInto(page, "Password", password)
            await page.getByRole("button", { name: "Sign in", exact: true }).click()
            const firstPairStill = await shows(page, `Signed in as ${email}.`)
            return [
                {
                    id: "errorFeedback",
                    expected: "yes",
                    observed: yesNo(conflict && firstPairStill),
                    note: `${conflict ? "a conflict refusal shows" : "no conflict refusal rendered"}; the first pair ${firstPairStill ? "still signs in" : "did not sign in"}`,
                },
            ]
        },
    )

    await run.step(page, 5, "sign-in-again", "Sign in with the registered pair a second time.", async () => {
        await openSignedOut(page)
        await toSignIn(page)
        await typeInto(page, "Email", email)
        await typeInto(page, "Password", password)
        await page.getByRole("button", { name: "Sign in", exact: true }).click()
        const again = await shows(page, `Signed in as ${email}.`)
        return [
            {
                id: "completion",
                expected: "yes",
                observed: yesNo(again),
                note: again
                    ? "a session issued again and the account page shows the same person"
                    : "the second sign-in did not show the person",
            },
        ]
    })

    const outcome = run.finish(baseURL ?? "")
    expect(outcome, "every step ran and every check observed its expected value").toBe("pass")
})
