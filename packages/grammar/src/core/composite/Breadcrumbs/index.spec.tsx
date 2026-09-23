// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { FAMILY_ROOTS, expectedFamilyScope, installVendorDomStubs } from "../../../__test__/navigationFamilies.js"
import { Breadcrumbs } from "./index.js"

beforeAll(installVendorDomStubs)
afterEach(cleanup)

const trail = [
    { id: "home", label: "Home", href: "/" },
    { id: "projects", label: "Projects", href: "/projects" },
    { id: "atlas", label: "Atlas", href: "/projects/atlas" },
]

describe.each(FAMILY_ROOTS)("Breadcrumbs under %s", (family, wrap) => {
    it("renders a named navigation landmark with an ordered trail", () => {
        render(wrap(<Breadcrumbs label="Breadcrumb" items={trail} />))
        expect(screen.getByTestId("grammar-root").getAttribute("data-grammar-family")).toBe(expectedFamilyScope(family))
        const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
        expect(nav.getAttribute("data-component")).toBe("Breadcrumbs")
        expect(within(nav).getByRole("list")).not.toBeNull()
        expect(within(nav).getAllByRole("listitem")).toHaveLength(3)
    })

    it("links ancestors and marks the last item as the current page", () => {
        render(wrap(<Breadcrumbs label="Breadcrumb" items={trail} />))
        const home = screen.getByRole("link", { name: "Home" })
        expect(home.getAttribute("href")).toBe("/")
        expect(home.getAttribute("aria-current")).toBeNull()
        const current = screen.getByText("Atlas").closest("[aria-current]")
        expect(current?.getAttribute("aria-current")).toBe("page")
        expect(current?.getAttribute("href")).toBeNull()
        const hooks = [...document.querySelectorAll("[data-grammar-breadcrumb]")].map((node) => node.getAttribute("data-grammar-current"))
        expect(hooks).toEqual(["false", "false", "true"])
    })

    it("reports router-owned navigation through onAction and keeps ancestors keyboard reachable", () => {
        const onAction = vi.fn()
        render(wrap(<Breadcrumbs label="Breadcrumb" items={trail} onAction={onAction} />))
        const projects = screen.getByRole("link", { name: "Projects" })
        projects.focus()
        expect(document.activeElement).toBe(projects)
        fireEvent.click(projects)
        expect(onAction).toHaveBeenCalledWith("projects")
    })
})
