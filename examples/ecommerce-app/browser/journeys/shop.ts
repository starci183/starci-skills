import { randomUUID } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"

/**
 * The one browser journey of the example (owner ruling: one minimal Playwright journey per example app,
 * dispatch-only in CI like e2e): a fresh shopper registers, browses the catalogue, adds one product, opens
 * the cart, checks out and sees the order confirmed pending. It runs against the real product - the shop app
 * and the be services of the environment it is pointed at (SHOP_BASE_URL, else the projected dev ports).
 *
 * Locators are roles and labels only: the surfaces' accessible names come from the product's own dictionary.
 */

/**
 * Type a field by keystrokes, not fill: the controlled inputs track React state, so keys must land after
 * hydration for the value to stick.
 */
const typeInto = async (page: Page, label: string, value: string): Promise<void> => {
    const field = page.getByLabel(label)
    await field.click()
    await field.pressSequentially(value)
}

test("browse the catalogue, add to the cart, and place the order", async ({ page }) => {
    // A fresh person per run: reruns on the same stack never collide on an existing email or a leftover cart.
    const run = randomUUID().replaceAll("-", "").slice(0, 12)
    const email = `browser-${run}@ecommerce.dev`
    const password = `pw-${randomUUID()}`

    // The catalogue is read through the session, so a signed-out browser meets the gate first.
    await page.goto("/en/browse")
    await expect(page.getByText("Sign in to browse")).toBeVisible()

    // Register through the account page's own form: toggle to register mode, type the pair, submit.
    await page.getByRole("link", { name: "Account", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
    await page.getByRole("button", { name: "New here? Create an account" }).click()
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
    await typeInto(page, "Email", email)
    await typeInto(page, "Password", password)
    await page.getByRole("button", { name: "Register", exact: true }).click()
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible()

    // Browse: the served catalogue lists real products, and one of them joins the cart.
    await page.getByRole("link", { name: "Browse", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Browse", level: 1 })).toBeVisible()
    await page.getByRole("button", { name: "Add to cart" }).first().click()
    await expect(page.getByText("In your cart: 1")).toBeVisible()

    // The cart shows the line and the way to checkout.
    await page.getByRole("link", { name: "Cart", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Cart", level: 1 })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible()
    await page.getByRole("link", { name: "Go to checkout" }).click()

    // Confirm: the service answers with the placed order, still pending its payment.
    await expect(page.getByRole("heading", { name: "Checkout", level: 1 })).toBeVisible()
    await page.getByRole("button", { name: "Confirm order" }).click()
    await expect(page.getByRole("heading", { name: "Order confirmed" })).toBeVisible()
    await expect(page.getByText(/is pending/)).toBeVisible()
})
