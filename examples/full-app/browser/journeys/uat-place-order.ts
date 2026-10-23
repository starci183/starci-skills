import { randomUUID } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"
import { formMode, shows, signedOutAccount, typeInto, UatRun, yesNo } from "./uat-run"

/**
 * uat.checkout.place-order - the flow record's seven steps walked one-to-one against the running product (the shop app, the
 * identity and order apis of the dev stack), through `starci uat record` only (the browser config ignores uat-*.ts otherwise).
 * A fresh disposable person per run, so the step-7 account answer can only be this run's order; a confirmed order and the
 * person stay in the demo store (the record's cleanup: the product has no delete for either). The seeded catalogue holds
 * 2 Steel thermos, which step 6 asks 3 of.
 */

const FLOW = "uat.checkout.place-order"

/** A product tile on browse, found by its heading. */
const tile = (page: Page, product: string) =>
    page.getByRole("heading", { name: product }).locator('xpath=ancestor::*[.//button[contains(., "Add to cart")]][1]')

test(`${FLOW}: sign in, add, confirm, replay, both refusals, account read`, async ({ page, context, baseURL }) => {
    test.setTimeout(300_000)
    const run = new UatRun(FLOW, "Browse, confirm an order, replay it, and hit both refusals")
    const tag = (process.env.UAT_RUN_ID ?? randomUUID()).toLowerCase().replace(/[^a-z0-9]/g, "")
    const email = `uat-buyer-${tag}@example.test`
    const password = `pw-${randomUUID()}`

    // The disposable person: registered through the product's register door, then signed out so step 1 signs in.
    await signedOutAccount(page)
    await formMode(page, "register")
    await typeInto(page, "Email", email)
    await typeInto(page, "Password", password)
    await page.getByRole("button", { name: "Register", exact: true }).click()
    await expect(page.getByText(`Signed in as ${email}.`)).toBeVisible()
    await signedOutAccount(page)
    run.resource({
        action: "created",
        kind: "person",
        id: email,
        note: "registered through the product's register door for this run",
    })

    await run.step(
        page,
        1,
        "sign-in-and-catalogue",
        "Sign in as the disposable person and open the catalogue.",
        async () => {
            await formMode(page, "sign-in")
            await typeInto(page, "Email", email)
            await typeInto(page, "Password", password)
            await page.getByRole("button", { name: "Sign in", exact: true }).click()
            const pending = await shows(page, "Signing in…", 3_000)
            const signedIn = await shows(page, `Signed in as ${email}.`)
            await page.goto("/en/browse")
            const listed = await shows(page, "Enamel mug")
            const priced = (await page.getByText(/\$\d+\.\d{2}/).count()) > 0
            return [
                {
                    id: "loading",
                    expected: "yes",
                    observed: yesNo(pending || signedIn),
                    note: pending
                        ? "the sign-in submit showed its pending label"
                        : "the session answered before the pending label could be read; the settled surface is the answer",
                },
                {
                    id: "completion",
                    expected: "yes",
                    observed: yesNo(signedIn && listed && priced),
                    note: `signed in: ${signedIn}; the catalogue lists products: ${listed}; with prices: ${priced}`,
                },
            ]
        },
    )

    await run.step(page, 2, "add-one-product", "Add one product to the cart.", async () => {
        await tile(page, "Enamel mug").getByRole("button", { name: "Add to cart" }).click()
        const counted = await shows(page, "In your cart: 1")
        await page.goto("/en/cart")
        const line = await shows(page, "Enamel mug")
        return [
            {
                id: "completion",
                expected: "yes",
                observed: yesNo(counted && line),
                note: `the tile answered "In your cart: 1": ${counted}; the cart shows the line: ${line}`,
            },
        ]
    })

    let orderId = ""
    await run.step(page, 3, "confirm-order", "Confirm the order.", async () => {
        await page.goto("/en/checkout")
        await page.getByRole("button", { name: "Confirm order" }).click()
        const pending = await shows(page, "Confirming…", 3_000)
        const confirmed = await shows(page, "Order confirmed")
        orderId =
            (
                (await page
                    .getByText(/Order [0-9a-f-]{36} is/)
                    .first()
                    .textContent()
                    .catch(() => "")) ?? ""
            ).match(/Order ([0-9a-f-]{36})/)?.[1] ?? ""
        // The emptied cart is read in a second tab, so this render (holding the attempt's idempotency key) stays for step 4.
        const cartTab = await context.newPage()
        await cartTab.goto("/en/cart")
        const emptied = await shows(cartTab, "Your cart is empty")
        await cartTab.close()
        if (orderId)
            run.resource({
                action: "created",
                kind: "order",
                id: orderId,
                note: "written by this run's confirmation; final, the product has no delete",
            })
        return [
            {
                id: "loading",
                expected: "yes",
                observed: yesNo(pending || confirmed),
                note: pending
                    ? "the confirm button showed its pending label"
                    : "the order answered before the pending label could be read",
            },
            {
                id: "completion",
                expected: "yes",
                observed: yesNo(confirmed && orderId !== "" && emptied),
                note: `confirmation ${orderId || "(no id)"}; the cart reads empty: ${emptied}`,
            },
        ]
    })

    await run.step(page, 4, "replay-confirmation", "Send the same confirmation again unchanged.", async () => {
        await page.getByRole("button", { name: "Confirm order" }).click()
        const replayed = await shows(page, /already sent/)
        const sameOrder = orderId !== "" && (await page.getByText(new RegExp(`Order ${orderId} `)).count()) > 0
        const refusals = await page.getByText(/The order service refused/).count()
        return [
            {
                id: "completion",
                expected: "yes",
                observed: yesNo(replayed && sameOrder),
                note: `the service returned the first order marked already sent: ${replayed}; same order id shown: ${sameOrder}`,
            },
            {
                id: "errorFeedback",
                expected: "no",
                observed: yesNo(refusals > 0),
                note: `refusal lines after the replay: ${refusals}`,
            },
        ]
    })

    await run.step(page, 5, "confirm-empty-cart", "Try to confirm with the cart now empty.", async () => {
        await page.goto("/en/checkout")
        const offered = await page
            .getByRole("button", { name: "Confirm order" })
            .isVisible()
            .catch(() => false)
        let refused = false
        if (offered) {
            await page.getByRole("button", { name: "Confirm order" }).click()
            refused = await shows(
                page,
                "The order service refused: your cart is empty. Nothing was placed and nothing changed.",
            )
        } else {
            refused = await shows(
                page,
                "Your cart is empty — the order service refuses a confirmation on it. Add items from browse first.",
            )
        }
        return [
            {
                id: "errorFeedback",
                expected: "yes",
                observed: yesNo(refused),
                note: offered
                    ? `confirm on the empty cart was refused with the cart-empty reason: ${refused}`
                    : `the empty checkout states the cart-empty refusal and offers no confirm: ${refused}`,
            },
        ]
    })

    await run.step(
        page,
        6,
        "beyond-stock-refusal",
        "Add a line for more of a product than the catalogue holds, then confirm.",
        async () => {
            await page.goto("/en/browse")
            for (let count = 1; count <= 3; count++) {
                await tile(page, "Steel thermos").getByRole("button", { name: "Add to cart" }).click()
                await expect(page.getByText(`In your cart: ${count}`)).toBeVisible()
            }
            await page.goto("/en/checkout")
            await page.getByRole("button", { name: "Confirm order" }).click()
            const refused = await shows(page, /Steel thermos has 2 in stock and you asked for 3/)
            await page.goto("/en/cart")
            const kept = await shows(page, "Steel thermos")
            return [
                {
                    id: "errorFeedback",
                    expected: "yes",
                    observed: yesNo(refused && kept),
                    note: `the refusal names the product, the stock 2 and the requested 3: ${refused}; the cart kept its line: ${kept}`,
                },
            ]
        },
    )

    await run.step(page, 7, "account-page", "Open the account page.", async () => {
        await page.goto("/en/account")
        const who = await shows(page, `Signed in as ${email}.`)
        const buyer = await shows(page, "The order service confirms this account has placed orders.")
        return [
            {
                id: "completion",
                expected: "yes",
                observed: yesNo(who && buyer),
                note: `the account page names this run's person: ${who}; it confirms the person has orders (only this run's order can cause that): ${buyer}`,
            },
        ]
    })

    // Cleanup the record declares: the session is ended through the product's own sign-out; the person and the order stay.
    await signedOutAccount(page)
    const ended = await shows(page, "You are browsing anonymously.")
    run.resource({
        action: "verified-absent",
        kind: "session",
        id: "run-session",
        note: `ended through the product sign-out; the account page reads signed out: ${ended}`,
    })

    const outcome = run.finish(baseURL ?? "")
    expect(outcome, "every step ran and every check observed its expected value").toBe("pass")
})
