import { describe, expect, it, vi, beforeEach } from "vitest"
import * as graphqlModule from "@/modules/api"
import { completeErasure, exportMyData, requestErasure } from "./api"

vi.mock("@/modules/api", async () => {
    const actual = await vi.importActual<typeof graphqlModule>("@/modules/api")
    return { ...actual, graphql: vi.fn() }
})

const mockedGraphql = () => graphqlModule.graphql as unknown as ReturnType<typeof vi.fn>

describe("privacy api", () => {
    beforeEach(() => mockedGraphql().mockReset())

    it("exportMyData returns the caller's own audit lines (fr.audit.export)", async () => {
        const lines = [{ at: "2026-09-21T09:00:00Z", action: "task.create", target: "t-1" }]
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: lines })

        await expect(exportMyData("tok-1")).resolves.toEqual(lines)
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("exportMyData"), undefined, "tok-1")
    })

    it("requestErasure files the caller's request (fr.audit.erasure.request)", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: { requestId: "e-1", state: "requested" } })

        await expect(requestErasure("tok-1")).resolves.toEqual({ requestId: "e-1", state: "requested" })
    })

    it("completeErasure names the request it completes and throws on a refusal", async () => {
        mockedGraphql().mockResolvedValueOnce({ ok: true, data: { requestId: "e-1", state: "completed" } })
        await expect(completeErasure("tok-1", "e-1")).resolves.toEqual({ requestId: "e-1", state: "completed" })
        expect(mockedGraphql()).toHaveBeenCalledWith(expect.stringContaining("completeErasure"), { requestId: "e-1" }, "tok-1")

        mockedGraphql().mockResolvedValueOnce({ ok: false, reason: "forbidden", code: "FORBIDDEN" })
        await expect(completeErasure("tok-1", "e-2")).rejects.toThrow("forbidden")
    })
})
