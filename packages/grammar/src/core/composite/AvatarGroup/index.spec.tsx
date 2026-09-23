// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { FAMILY_WRAPS, expectedFamilyScope } from "../../../__test__/grammarRoots.js"
import { AvatarGroup } from "./index.js"

afterEach(cleanup)

const people = ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Katherine Johnson", "Edsger Dijkstra"]
    .map((name, index) => ({ id: `p${index}`, name }))

describe.each(FAMILY_WRAPS)("AvatarGroup under %s", (family, wrap) => {
    it("names the group, draws the first `max` avatars and announces the overflow", () => {
        render(wrap(<AvatarGroup label="Members" items={people} max={3} overflowLabel={(count) => `${count} more`} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const group = screen.getByRole("group", { name: "Members" })
        expect(group.getAttribute("data-component")).toBe("AvatarGroup")
        expect(group.getAttribute("data-grammar-avatar-overflow")).toBe("true")
        expect(within(group).getByRole("img", { name: "Ada Lovelace" })).not.toBeNull()
        expect(within(group).queryByRole("img", { name: "Katherine Johnson" })).toBeNull()
        const count = within(group).getByRole("img", { name: "2 more" })
        expect(count.getAttribute("data-grammar-avatar-count")).toBe("true")
        expect(count.textContent).toBe("+2")
    })

    it("draws no count when every avatar fits", () => {
        render(wrap(<AvatarGroup label="Pair" items={people.slice(0, 2)} overflowLabel={(count) => `${count} more`} />))
        const group = screen.getByRole("group", { name: "Pair" })
        expect(group.getAttribute("data-grammar-avatar-overflow")).toBe("false")
        expect(group.querySelector("[data-grammar-avatar-count]")).toBeNull()
        expect(within(group).getAllByRole("img")).toHaveLength(2)
    })
})
