import fs from "node:fs"
import path from "node:path"
import { test, type Page } from "@playwright/test"

/**
 * The run folder of one UAT walk, written for `starci uat record` (the runtime verb that holds the UAT slot, records the
 * browser and files the folder as the flow's evidence). The verb hands the folder in UAT_RUN_DIR and the run id in UAT_RUN_ID;
 * this writer fills it with exactly what a uat.verify run keeps: screens/step<N>-<label>.png per declared step, result.md and
 * manifest.yaml (the per-step yes/no checks with their expected value, the owned resources and the outcome). The recorder adds
 * the video. A check is answered yes or no from what the page actually showed; the outcome is pass only when every check
 * observed its expected value and every step ran to its end.
 */

/** One yes/no observation of a step, against the value the flow record expects. */
export interface Check {
    readonly id: string
    readonly expected: "yes" | "no"
    readonly observed: "yes" | "no"
    readonly note: string
}

/** One resource the walk created or verified, named by its id (never a credential value). */
export interface Resource {
    readonly action: "created" | "verified-absent"
    readonly kind: string
    readonly id: string
    readonly note: string
}

interface StepRecord {
    readonly order: number
    readonly label: string
    readonly action: string
    readonly startedAt: string
    readonly endedAt: string
    readonly screen: string
    readonly checks: ReadonlyArray<Check>
    readonly error: string | null
}

const slug = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")

/** The folder the verb handed in; a walk outside `starci uat record` has none and is refused. */
const runDir = (): string => {
    const dir = process.env.UAT_RUN_DIR
    if (!dir) throw new Error("UAT_RUN_DIR is not set: run this walk through `starci uat record`")
    return dir
}

export class UatRun {
    private readonly steps: Array<StepRecord> = []
    private readonly resources: Array<Resource> = []

    constructor(
        private readonly flow: string,
        private readonly title: string,
    ) {
        fs.mkdirSync(path.join(runDir(), "screens"), { recursive: true })
    }

    /** Records an owned resource of the walk. */
    resource(entry: Resource): void {
        this.resources.push(entry)
    }

    /**
     * Runs one declared step as a Playwright step, then screenshots the page (password fields masked). `act` performs the
     * step's action and answers its checks; a step that throws is kept with its error and fails the walk.
     */
    async step(
        page: Page,
        order: number,
        label: string,
        action: string,
        act: () => Promise<ReadonlyArray<Check>>,
    ): Promise<void> {
        const screen = `screens/step${order}-${slug(label)}.png`
        const startedAt = new Date().toISOString()
        let checks: ReadonlyArray<Check> = []
        let error: string | null = null
        await test.step(`step ${order}: ${label}`, async () => {
            try {
                checks = await act()
            } catch (cause) {
                error = cause instanceof Error ? (cause.message.split("\n")[0] ?? "error") : String(cause)
            }
            const passwords = page.locator('input[type="password"]')
            const masked = (await passwords.count().catch(() => 0)) > 0 ? [passwords] : []
            await page.screenshot({ path: path.join(runDir(), ...screen.split("/")), mask: masked })
        })
        this.steps.push({ order, label, action, startedAt, endedAt: new Date().toISOString(), screen, checks, error })
    }

    /** The walk's outcome: pass only when every step ran and every check observed its expected value. */
    get outcome(): "pass" | "fail" {
        const allRan = this.steps.every((step) => step.error === null)
        const allMet = this.steps.every((step) => step.checks.every((check) => check.observed === check.expected))
        return allRan && allMet && this.steps.length > 0 ? "pass" : "fail"
    }

    /** Writes manifest.yaml (JSON, which is YAML) and result.md into the run folder. */
    finish(baseURL: string): "pass" | "fail" {
        const outcome = this.outcome
        const manifest = {
            flow: this.flow,
            run: process.env.UAT_RUN_ID ?? null,
            baseURL,
            outcome,
            steps: this.steps,
            resources: this.resources,
        }
        fs.writeFileSync(path.join(runDir(), "manifest.yaml"), `${JSON.stringify(manifest, null, 2)}\n`)
        const lines = [
            `# ${this.flow} - ${this.title}`,
            "",
            `Run ${manifest.run ?? "(no id)"} against ${baseURL}: **${outcome}**.`,
            "",
            "| step | check | expected | observed | note |",
            "| --- | --- | --- | --- | --- |",
            ...this.steps.flatMap((step) => [
                ...step.checks.map(
                    (check) =>
                        `| ${step.order}. ${step.label} | ${check.id} | ${check.expected} | ${check.observed} | ${check.note.replaceAll("|", "/")} |`,
                ),
                ...(step.error
                    ? [`| ${step.order}. ${step.label} | (step) | ran | failed | ${step.error.replaceAll("|", "/")} |`]
                    : []),
            ]),
            "",
            "## Resources",
            "",
            ...(this.resources.length
                ? this.resources.map((r) => `- ${r.action} ${r.kind} ${r.id}: ${r.note}`)
                : ["- none"]),
            "",
        ]
        fs.writeFileSync(path.join(runDir(), "result.md"), lines.join("\n"))
        return outcome
    }
}

/** yes when `value` is true, else no. */
export const yesNo = (value: boolean): "yes" | "no" => (value ? "yes" : "no")

/** Types a field by keystrokes after hydration (a controlled input resets a pre-hydration fill). */
export const typeInto = async (page: Page, label: string, value: string): Promise<void> => {
    const field = page.getByLabel(label)
    await field.click()
    await field.fill("")
    if (value) await field.pressSequentially(value)
}

/** Whether `locator`-like text becomes visible within `timeout` ms. */
export const shows = async (page: Page, text: string | RegExp, timeout = 15_000): Promise<boolean> =>
    page
        .getByText(text)
        .first()
        .waitFor({ state: "visible", timeout })
        .then(() => true)
        .catch(() => false)

const MODE_HEADING = { "sign-in": "Welcome back", register: "Create your account" } as const
const MODE_TOGGLE = { "sign-in": "Already have an account? Sign in", register: "New here? Create an account" } as const

/**
 * Puts the account form in `mode`. The form keeps its last mode across a sign-out, and its toggle carries a press lock that can
 * swallow a press, so the heading decides and the toggle is pressed until it shows (every wait bounded).
 */
export const formMode = async (page: Page, mode: "sign-in" | "register"): Promise<void> => {
    for (let attempt = 0; attempt < 5; attempt++) {
        if (
            await page
                .getByRole("heading", { name: MODE_HEADING[mode] })
                .isVisible()
                .catch(() => false)
        )
            return
        await page
            .getByRole("button", { name: MODE_TOGGLE[mode] })
            .click({ timeout: 5_000 })
            .catch(() => undefined)
        await page.waitForTimeout(400)
    }
    await page.getByRole("heading", { name: MODE_HEADING[mode] }).waitFor({ state: "visible", timeout: 5_000 })
}

/**
 * Opens the account page signed out: a live session is ended through the product's own sign-out first. The session is held by
 * the browser (modules/auth), so the page renders anonymous first and re-renders signed in once it reads the session: the
 * sign-out control is waited for, not sampled.
 */
export const signedOutAccount = async (page: Page): Promise<void> => {
    await page.goto("/en/account")
    await page.waitForLoadState("networkidle").catch(() => undefined)
    const signOut = page.getByRole("button", { name: "Sign out" })
    if (
        await signOut.waitFor({ state: "visible", timeout: 3_000 }).then(
            () => true,
            () => false,
        )
    ) {
        await signOut.click({ timeout: 5_000 })
        await page.getByText("You are browsing anonymously.").waitFor({ state: "visible", timeout: 15_000 })
    }
}
