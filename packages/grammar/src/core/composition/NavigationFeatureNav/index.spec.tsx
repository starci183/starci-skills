// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { NavigationFeatureNav } from "./index.js"

afterEach(cleanup)

describe("Core NavigationFeatureNav", () => {
    it("owns one or two layers without accepting a third navigation scope", () => {
        const { container } = render(
            <NavigationFeatureNav
                identity={<a href="/">StarCi</a>}
                navigation={<a href="/courses">Courses</a>}
                navigationLabel="Global navigation"
                compactNavigationTrigger={<button type="button">More</button>}
                compactNavigationTriggerLabel="Compact navigation"
                actions={<button type="button">Account</button>}
                actionsLabel="Utilities"
                featureNavigation={<nav aria-label="Dashboard features"><a href="/dashboard">Overview</a></nav>}
                featureNavigationLabel="Feature layer"
            />,
        )

        expect(container.querySelector("[data-grammar-navigation-feature-nav='true']")?.getAttribute("data-grammar-navigation-feature-nav-layers")).toBe("two")
        expect(container.querySelector("[data-grammar-navigation-feature-nav-feature='true']")?.classList.contains("starci-core-page-container")).toBe(false)
        expect(screen.getByRole("navigation", { name: "Global navigation" })).toBeTruthy()
        expect(screen.getByRole("navigation", { name: "Dashboard features" })).toBeTruthy()
        expect(screen.getByRole("group", { name: "Compact navigation" })).toBeTruthy()
        expect(screen.getByRole("group", { name: "Utilities" })).toBeTruthy()
    })

    it("renders only the global layer when feature navigation is absent", () => {
        const { container } = render(
            <NavigationFeatureNav
                identity="StarCi"
                navigation="Routes"
                navigationLabel="Global navigation"
                compactNavigationTrigger={<button type="button">More</button>}
                compactNavigationTriggerLabel="Compact navigation"
                position="static"
            />,
        )

        expect(container.querySelector("[data-grammar-navigation-feature-nav='true']")?.getAttribute("data-grammar-navigation-feature-nav-layers")).toBe("one")
        expect(container.querySelector("[data-grammar-navigation-feature-nav-feature='true']")).toBeNull()
    })

    /**
     * Every band slot's shipped CSS targets `:where(button, [role="button"], a[href])`, or - for
     * the identity slot - a `plain` TextAction, or - for the navigation slot - a `route` TextAction
     * (styles.spec.ts asserts the rules themselves). This proves the OTHER half: that a realistic
     * consumer's rendered markup is exactly what those selectors match, so the 44px floor lands on
     * every pressable actually present rather than on a shape nobody renders.
     */
    it("puts every band pressable inside a slot the 44px floor actually reaches", () => {
        render(
            <NavigationFeatureNav
                identity={<a href="/" data-appearance="plain" className="starci-core-text-action">StarCi</a>}
                navigation={<>
                    <a href="/courses" data-appearance="route" className="starci-core-text-action">Courses</a>
                    <a href="/pricing" data-appearance="route" className="starci-core-text-action">Pricing</a>
                    <a href="/about" data-appearance="route" className="starci-core-text-action">About</a>
                </>}
                navigationLabel="Global navigation"
                compactNavigationTrigger={<button type="button">More</button>}
                compactNavigationTriggerLabel="Compact navigation"
                actions={<>
                    <button type="button">Cart</button>
                    <a href="/account">Account</a>
                </>}
                actionsLabel="Utilities"
            />,
        )

        const identityPressable = screen.getByRole("link", { name: "StarCi" })
        expect(identityPressable.closest(".starci-core-navigation-feature-nav-identity")).toBeTruthy()
        expect(identityPressable.matches(".starci-core-text-action[data-appearance=\"plain\"]")).toBe(true)

        const navigation = screen.getByRole("navigation", { name: "Global navigation" })
        const destinations = navigation.querySelectorAll(".starci-core-text-action[data-appearance=\"route\"]")
        expect(destinations).toHaveLength(3)
        for (const destination of destinations) {
            expect(destination.matches(":where(button, [role=\"button\"], a[href])")).toBe(true)
        }

        const compact = screen.getByRole("group", { name: "Compact navigation" })
        const compactTrigger = compact.querySelector("button")
        expect(compactTrigger).not.toBeNull()
        expect(compactTrigger?.matches(":where(button, [role=\"button\"], a[href])")).toBe(true)

        const actions = screen.getByRole("group", { name: "Utilities" })
        for (const pressable of actions.querySelectorAll("button, a[href]")) {
            expect(pressable.matches(":where(button, [role=\"button\"], a[href])")).toBe(true)
        }
    })
})
