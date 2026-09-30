import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { useSignOut } from "./useSignOut"

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    token: "token-1" as string | null,
    clearToken: vi.fn(),
    signOut: vi.fn(() => Promise.resolve(true)),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("./useSessionToken", () => ({ useSessionToken: () => mocks.token }))
vi.mock("@/modules/session", () => ({ clearToken: mocks.clearToken }))
vi.mock("@/modules/api", () => ({ signOut: mocks.signOut }))

describe("useSignOut", () => {
    beforeEach(() => {
        mocks.push.mockReset()
        mocks.clearToken.mockReset()
        mocks.signOut.mockClear()
        mocks.token = "token-1"
    })

    it("clears the local session, ends the remote one and lands on sign-in", () => {
        const { result } = renderHook(() => useSignOut())

        result.current()

        expect(mocks.clearToken).toHaveBeenCalledTimes(1)
        expect(mocks.signOut).toHaveBeenCalledWith("token-1")
        expect(mocks.push).toHaveBeenCalledWith("/sign-in")
    })

    it("still clears and navigates when there is no session to end remotely", () => {
        mocks.token = null
        const { result } = renderHook(() => useSignOut())

        result.current()

        expect(mocks.clearToken).toHaveBeenCalledTimes(1)
        expect(mocks.signOut).not.toHaveBeenCalled()
        expect(mocks.push).toHaveBeenCalledWith("/sign-in")
    })
})
