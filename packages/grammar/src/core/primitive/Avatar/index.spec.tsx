// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FAMILY_WRAPS, expectedFamilyScope } from "../../../__test__/grammarRoots.js"
import { Avatar, avatarInitials } from "./index.js"

afterEach(cleanup)

describe("avatarInitials", () => {
    it("takes up to two initials from the supplied name", () => {
        expect(avatarInitials("ada lovelace byron")).toBe("AL")
        expect(avatarInitials("  Grace ")).toBe("G")
        expect(avatarInitials("")).toBe("")
    })
})

describe.each(FAMILY_WRAPS)("Avatar under %s", (family, wrap) => {
    it("is a named image with an initials fallback while the image is unavailable", () => {
        render(wrap(<Avatar name="Ada Lovelace" src="/ada.png" size="lg" />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const avatar = screen.getByRole("img", { name: "Ada Lovelace" })
        expect(avatar.getAttribute("data-component")).toBe("Avatar")
        expect(avatar.getAttribute("data-grammar-avatar-size")).toBe("lg")
        expect(avatar.getAttribute("data-grammar-current")).toBe("false")
        const fallback = avatar.querySelector("[data-grammar-avatar-fallback]")
        expect(fallback?.textContent).toBe("AL")
        expect(fallback?.getAttribute("aria-hidden")).toBe("true")
    })

    it("marks the current identity and honours a custom fallback", () => {
        render(wrap(<Avatar name="Team" fallback={<span>T</span>} isCurrent />))
        const avatar = screen.getByRole("img", { name: "Team" })
        expect(avatar.getAttribute("data-grammar-current")).toBe("true")
        expect(avatar.textContent).toBe("T")
    })

    it("leaves the accessibility tree when decorative", () => {
        const { container } = render(wrap(<Avatar name="Ada" isDecorative />))
        expect(screen.queryByRole("img")).toBeNull()
        expect(container.querySelector("[data-component='Avatar']")?.getAttribute("aria-hidden")).toBe("true")
    })
})
