import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { SignOutActionBase, type SignOutActionProps } from "./component"

const surfaceFor = (state: SignOutActionProps["state"], onSignOut: () => void = () => {}): SignOutActionProps => ({
    state,
    props: { label: "Sign out" },
    on: { onSignOut },
})

describe("SignOutActionBase", () => {
    it("ready: the press reports upward once", () => {
        const onSignOut = vi.fn()
        render(<SignOutActionBase {...surfaceFor("ready", onSignOut)} />)

        fireEvent.click(screen.getByRole("button", { name: "Sign out" }))
        expect(onSignOut).toHaveBeenCalledTimes(1)
    })

    it("working: pending withholds a duplicate press", () => {
        render(<SignOutActionBase {...surfaceFor("working")} />)

        expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled()
    })
})
