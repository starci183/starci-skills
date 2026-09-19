import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { SignInPage } from "./index"
import { TasksPage } from "@/components/pages/TasksPage"
import { renderJourney, resetJourneyWorld, serveGraphQL, type Wire, type WireReply } from "@/testing/journey"

const mocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))

const EMAIL = "alex@example.com"
const PASSWORD = "correct-horse-battery"

/** The credential the app leaves behind for the next mount to find. */
const SESSION_KEY = "todo-app.session-token"

/**
 * The frames `login/uat/sign-in` captures - empty, filled, working, refused, signed-in and the
 * reload that must still find a session - driven through the served screen. Mounted at the route's
 * own page half, so the welcome panel, the connected form, `useSignIn`, `modules/api/auth`,
 * `modules/session` and the GraphQL fetcher all run exactly as the browser runs them.
 */
describe("ui.login.sign-in journey: the served sign-in screen over the real transport", () => {
    let wire: Wire

    afterEach(() => {
        resetJourneyWorld()
        mocks.push.mockReset()
    })

    const fillThePair = () => {
        fireEvent.change(screen.getByLabelText("Email"), { target: { value: EMAIL } })
        fireEvent.change(screen.getByLabelText("Password"), { target: { value: PASSWORD } })
        fireEvent.click(screen.getByRole("button", { name: "Sign in" }))
    }

    it("empty: the screen asks for the pair and offers nothing to submit", () => {
        wire = serveGraphQL({ signIn: { data: { sessionToken: "tok-1", personId: "p-1" } } })
        renderJourney(<SignInPage />)

        expect(screen.getByText("Enter your email and password to continue.")).toBeInTheDocument()
        expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled()
        expect(wire.calls).toHaveLength(0)
    })

    it("filled: one half of the pair alone still submits nothing", () => {
        wire = serveGraphQL({ signIn: { data: { sessionToken: "tok-1", personId: "p-1" } } })
        renderJourney(<SignInPage />)

        fireEvent.change(screen.getByLabelText("Email"), { target: { value: EMAIL } })
        expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled()
        expect(screen.getByText("Enter your password to continue.")).toBeInTheDocument()
        fireEvent.click(screen.getByRole("button", { name: "Sign in" }))
        expect(wire.callsFor("signIn")).toHaveLength(0)

        fireEvent.change(screen.getByLabelText("Password"), { target: { value: PASSWORD } })
        expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled()
        expect(screen.queryByText(/to continue\./)).not.toBeInTheDocument()
    })

    it("working: the submit holds the screen in its pending frame until the answer arrives", async () => {
        let release: (reply: WireReply) => void = () => {}
        const pending = new Promise<WireReply>(resolve => {
            release = resolve
        })
        wire = serveGraphQL({ signIn: () => pending })
        renderJourney(<SignInPage />)
        fillThePair()

        await waitFor(() => expect(screen.getByRole("button", { name: "Signing in..." })).toBeInTheDocument())
        expect(screen.getByLabelText("Email")).toBeDisabled()
        expect(mocks.push).not.toHaveBeenCalled()
        expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()

        release({ data: { sessionToken: "tok-1", personId: "p-1" } })
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/tasks"))
    })

    it("signed-in: a successful submit stores the issued session and lands the reader on their list", async () => {
        wire = serveGraphQL({ signIn: { data: { sessionToken: "tok-fresh", personId: "p-1" } } })
        renderJourney(<SignInPage />)
        fillThePair()

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/tasks"))
        expect(window.localStorage.getItem(SESSION_KEY)).toBe("tok-fresh")
        const call = wire.callsFor("signIn")[0]
        expect(call.variables).toEqual({ input: { email: EMAIL, password: PASSWORD } })
        // Sign-in is the one call that cannot carry a bearer credential: there is no session yet.
        expect(call.token).toBeNull()
    })

    it("session-restores-on-reload: the session a completed sign-in left behind is the credential the next screen reads with", async () => {
        serveGraphQL({ signIn: { data: { sessionToken: "tok-reused", personId: "p-1" } } })
        const signInView = renderJourney(<SignInPage />)
        fillThePair()
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/tasks"))
        signInView.unmount()

        // A fresh mount, no sign-in in its way: this is what the reader's reload gets.
        const reads = serveGraphQL({ tasks: { data: [] } })
        renderJourney(<TasksPage />)
        await waitFor(() => expect(reads.callsFor("tasks")).toHaveLength(1))
        expect(reads.callsFor("tasks")[0].token).toBe("tok-reused")
        expect(screen.getByText("No tasks yet. Add the first one.")).toBeInTheDocument()
    })

    it("refused: a bad pair names the screen's own sentence, keeps the email and asks for the password again", async () => {
        wire = serveGraphQL({ signIn: { reason: "No person answers to that address.", code: "PERSON_NOT_FOUND" } })
        renderJourney(<SignInPage />)
        fireEvent.change(screen.getByLabelText("Email"), { target: { value: EMAIL } })
        fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } })
        fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That email and password do not match."))
        expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(EMAIL)
        expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("")
        expect(mocks.push).not.toHaveBeenCalled()
        expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()
    })

    it("br.login.password.sign-in: an unknown address, a wrong password and a dead network all read identically", async () => {
        const refusals: Array<WireReply> = [
            { reason: "No person answers to that address.", code: "PERSON_NOT_FOUND" },
            { reason: "The password does not match that address.", code: "PASSWORD_MISMATCH" },
            { network: true },
        ]
        for (const refusal of refusals) {
            serveGraphQL({ signIn: refusal })
            const view = renderJourney(<SignInPage />)
            fillThePair()

            await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("That email and password do not match."))
            // The reason the backend gave never reaches the reader: neither half of the pair is named.
            expect(screen.queryByText(/address/)).not.toBeInTheDocument()
            expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()
            view.unmount()
            resetJourneyWorld()
        }
    })
})
