import { describe, expect, it, vi, beforeEach } from "vitest"
import * as graphqlModule from "@/modules/api/graphql"
import { readPlanUsage, startPlanCheckout } from "./api"

vi.mock("@/modules/api/graphql", async () => {
    const actual = await vi.importActual<typeof graphqlModule>("@/modules/api/graphql")
    return { ...actual, graphql: vi.fn() }
})

const mockedGraphql = () => graphqlModule.graphql as unknown as ReturnType<typeof vi.fn>

describe("readPlanUsage", () => {
    beforeEach(() => mockedGraphql().mockReset())

    it("returns the planUsage payload the backend contract declares (fr.plan.usage.view)", async () => {
        mockedGraphql().mockResolvedValueOnce({
            ok: true,
            data: { plan: "free", cap: 20, activeCount: 40 },
        })

        await expect(readPlanUsage("tok-1")).resolves.toEqual({ plan: "free", cap: 20, activeCount: 40 })
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("planUsage"), undefined, "tok-1")
    })

    it("carries cap null through for the paid plan (sds.plan.subscription-lifecycle)", async () => {
        mockedGraphql().mockResolvedValueOnce({
            ok: true,
            data: { plan: "paid", cap: null, activeCount: 40 },
        })

        await expect(readPlanUsage("tok-1")).resolves.toEqual({ plan: "paid", cap: null, activeCount: 40 })
    })

    it("throws when the transport refuses (an expired or missing session)", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: false, reason: "The session is not active.", code: "SESSION_NOT_FOUND" })

        await expect(readPlanUsage("tok-1")).rejects.toThrow("The session is not active.")
    })
})

describe("startPlanCheckout", () => {
    beforeEach(() => mockedGraphql().mockReset())

    it("returns the checkout URL the upgrade mutation issues (fr.plan.upgrade)", async () => {
        mockedGraphql().mockResolvedValueOnce({
            ok: true,
            data: { subscriptionId: "sub-1", paymentIntentId: "pi-1", checkoutUrl: "https://pay.example/checkout/pi-1", status: "pending" },
        })

        await expect(startPlanCheckout("tok-1")).resolves.toEqual({
            subscriptionId: "sub-1",
            paymentIntentId: "pi-1",
            checkoutUrl: "https://pay.example/checkout/pi-1",
            status: "pending",
        })
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("upgradePlan"), undefined, "tok-1")
    })

    it("throws when the transport refuses, so no paid state can be invented from a failed call", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: false, reason: "network", code: "NETWORK" })

        await expect(startPlanCheckout("tok-1")).rejects.toThrow("network")
    })
})
