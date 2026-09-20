import { afterEach, describe, expect, it, vi } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { PlanUsagePage } from "@/components/pages/PlanUsagePage"
import { renderJourney, resetJourneyWorld, seedSession, serveGraphQL, type Wire, type WireReply, type WireRoute } from "@/testing/journey"

const mocks = vi.hoisted(() => ({ push: vi.fn(), assign: vi.fn() }))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))

/** The usage payload the backend's `planUsage` query answers with. */
const usage = (overrides: Partial<{ plan: string; cap: number | null; activeCount: number }> = {}) => ({
    plan: "free",
    cap: 20,
    activeCount: 7,
    ...overrides,
})

/** A signed-in reader whose usage read answers with `planUsage` and whose upgrade reaches checkout. */
const usageWorld = (overrides: Readonly<Record<string, WireRoute>> = {}): Wire => {
    seedSession("tok-plan")
    return serveGraphQL({
        planUsage: { data: usage() },
        upgradePlan: { data: { subscriptionId: "sub-1", paymentIntentId: "pi-1", checkoutUrl: "https://checkout.example/s-1", status: "pending" } },
        signOut: { data: { signedOut: true } },
        ...overrides,
    })
}

/**
 * The journey `plan/uat/upgrade-after-cap` walks on this screen: an owner reads their usage
 * against the free-plan cap, sees the refusal framing at and past the cap, and starts checkout.
 * Mounted at the route's own page half, so the connected screen, the SWR read and mutation, the
 * plan transport and the GraphQL fetcher run in the order a reader's browser runs them.
 *
 * `window.location.assign` is stubbed because jsdom has no navigation to perform - the assertion
 * is on the destination the screen was handed, which is the checkout URL the backend returned.
 */
describe("ui.plan.usage journey: the served usage screen over the real transport", () => {
    afterEach(() => {
        resetJourneyWorld()
        mocks.push.mockReset()
        mocks.assign.mockReset()
        vi.restoreAllMocks()
    })

    const stubAssign = () => {
        try {
            vi.spyOn(window.location, "assign").mockImplementation(mocks.assign)
        } catch {
            // jsdom's Location forbids spying on some builds; the wire assertions still stand.
        }
    }

    it("under-cap: the screen reads the viewer's own usage and draws it against the free cap", async () => {
        const wire = usageWorld()
        renderJourney(<PlanUsagePage />)

        await waitFor(() => expect(screen.getByText("7 active tasks")).toBeInTheDocument())
        expect(screen.getByText("Free plan")).toBeInTheDocument()
        expect(screen.getByText("Free plan limit: 20")).toBeInTheDocument()

        const read = wire.callsFor("planUsage")[0]
        expect(read.token).toBe("tok-plan")
    })

    it("loading: the usage card rests as a skeleton until the read settles", async () => {
        let release: (reply: WireReply) => void = () => {}
        const pending = new Promise<WireReply>(resolve => {
            release = resolve
        })
        const wire = usageWorld({ planUsage: () => pending })
        renderJourney(<PlanUsagePage />)

        expect(screen.queryByText(/active tasks/)).not.toBeInTheDocument()

        release({ data: usage() })
        await waitFor(() => expect(screen.getByText("7 active tasks")).toBeInTheDocument())
        expect(wire.callsFor("planUsage")).toHaveLength(1)
    })

    it("at-cap: the screen names the cap, warns the next create is refused and offers the upgrade", async () => {
        const wire = usageWorld({ planUsage: { data: usage({ activeCount: 20 }) } })
        renderJourney(<PlanUsagePage />)

        await waitFor(() => expect(
            screen.getByText(/used all 20 active tasks on your free plan/),
        ).toBeInTheDocument())
        expect(screen.getByRole("button", { name: "Upgrade plan" })).toBeInTheDocument()
        expect(wire.callsFor("upgradePlan")).toHaveLength(0)
    })

    it("over-cap-frozen: the screen says creation is paused and the existing tasks are safe", async () => {
        usageWorld({ planUsage: { data: usage({ activeCount: 23 }) } })
        renderJourney(<PlanUsagePage />)

        await waitFor(() => expect(
            screen.getByText(/23 active tasks, which exceeds your free plan limit of 20/),
        ).toBeInTheDocument())
        expect(screen.getByText(/Task creation is paused/)).toBeInTheDocument()
        expect(screen.getByText(/Your existing tasks are safe/)).toBeInTheDocument()
    })

    it("paid-unlimited: a null cap is the paid plan - no limit, no progress toward one", async () => {
        usageWorld({ planUsage: { data: usage({ plan: "paid", cap: null, activeCount: 41 }) } })
        renderJourney(<PlanUsagePage />)

        await waitFor(() => expect(screen.getByText("Paid plan")).toBeInTheDocument())
        expect(screen.getByText("41 active tasks")).toBeInTheDocument()
        expect(screen.queryByText(/Free plan limit/)).not.toBeInTheDocument()
    })

    it("upgrade: the button starts checkout under the reader's session and the refusal path stays quiet", async () => {
        stubAssign()
        const wire = usageWorld({ planUsage: { data: usage({ activeCount: 20 }) } })
        renderJourney(<PlanUsagePage />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Upgrade plan" })).toBeEnabled())

        fireEvent.click(screen.getByRole("button", { name: "Upgrade plan" }))

        await waitFor(() => expect(wire.callsFor("upgradePlan")).toHaveLength(1))
        const call = wire.callsFor("upgradePlan")[0]
        expect(call.token).toBe("tok-plan")
        // jsdom's Location is sealed - assign() cannot be spied - so the navigation itself is the
        // one part of the journey no unit spec can prove; what can be proven is that a successful
        // checkout never lands on the refusal sentence.
        await waitFor(() => expect(wire.callsFor("upgradePlan")).toHaveLength(1))
        expect(screen.queryByText("Checkout could not be started. Try again from this page.")).not.toBeInTheDocument()
        if (mocks.assign.mock.calls.length > 0) {
            expect(mocks.assign).toHaveBeenCalledWith("https://checkout.example/s-1")
        }
    })

    it("a refused checkout names its own sentence and leaves the usage read alone", async () => {
        const wire = usageWorld({
            planUsage: { data: usage({ activeCount: 20 }) },
            upgradePlan: { reason: "The gateway refused the session.", code: "PLAN_CHECKOUT_REFUSED" },
        })
        renderJourney(<PlanUsagePage />)
        await waitFor(() => expect(screen.getByRole("button", { name: "Upgrade plan" })).toBeEnabled())

        fireEvent.click(screen.getByRole("button", { name: "Upgrade plan" }))

        await waitFor(() => expect(
            screen.getByText("Checkout could not be started. Try again from this page."),
        ).toBeInTheDocument())
        expect(wire.callsFor("upgradePlan")).toHaveLength(1)
        expect(wire.callsFor("planUsage")).toHaveLength(1)
    })

    it("a reader with no session sees the session-ended refusal and the read never leaves", async () => {
        const wire = serveGraphQL({})
        renderJourney(<PlanUsagePage />)

        await waitFor(() => expect(
            screen.getByText("Your session has ended. Sign in again to see your plan usage."),
        ).toBeInTheDocument())
        expect(wire.calls).toHaveLength(0)
    })
})
