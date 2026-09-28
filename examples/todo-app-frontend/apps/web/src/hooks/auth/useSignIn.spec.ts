import { describe, expect, it, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSignIn } from "./useSignIn"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}))

vi.mock("@/modules/api/auth", () => ({
    signIn: vi.fn(),
}))

vi.mock("@/modules/session", () => ({
    setToken: vi.fn(),
}))

import { signIn as requestSignIn } from "@/modules/api/auth"

describe("useSignIn", () => {
    beforeEach(() => {
        pushMock.mockReset()
        vi.mocked(requestSignIn).mockReset()
    })

    it("fr.login.sign-in: a successful sign-in navigates to /tasks (grit #36 - lands on their list)", async () => {
        vi.mocked(requestSignIn).mockResolvedValue({ token: "token-1" })
        const { result } = renderHook(() => useSignIn())

        await act(async () => {
            await result.current.submit("person@example.com", "correct-password")
        })

        expect(pushMock).toHaveBeenCalledTimes(1)
        expect(pushMock).toHaveBeenCalledWith("/tasks")
        expect(result.current.refusal).toBeNull()
        expect(result.current.submitting).toBe(false)
    })

    it("a refused sign-in never navigates", async () => {
        vi.mocked(requestSignIn).mockRejectedValue(new Error("That email and password do not match."))
        const { result } = renderHook(() => useSignIn())

        await act(async () => {
            await result.current.submit("person@example.com", "wrong-password")
        })

        expect(pushMock).not.toHaveBeenCalled()
        expect(result.current.refusal).toBe("That email and password do not match.")
    })
})
