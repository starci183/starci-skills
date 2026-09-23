// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope, installDomShims } from "../../../__test__/grammarRoots.js"
import { SurfaceAccordionCard } from "./index.js"

installDomShims()
afterEach(cleanup)

const noop = () => undefined
const Card = (props: { readonly headingLevel?: 2 | 3 | 4 | 5 | 6; readonly isScrollable?: boolean }) => (
    <SurfaceAccordionCard
        label="Questions"
        depth="top"
        isOpen={false}
        onOpenChange={noop}
        summaryRender="Summary"
        bodyRender="Body"
        renderSummary={(summary: string) => summary}
        renderBody={(body: string) => body}
        {...props}
    />
)

describe.each(GRAMMAR_ROOT_CASES)("Common SurfaceAccordionCard under $name", ({ Root, family }) => {
    it("names itself with an h3 by default and takes the page heading level", () => {
        const { unmount } = render(<Root><Card /></Root>)
        expectInFamilyScope(screen.getByRole("heading", { name: "Questions", level: 3 }), family)
        unmount()
        render(<Root><Card headingLevel={2} /></Root>)
        expect(screen.getByRole("heading", { name: "Questions", level: 2 })).toBeTruthy()
    })

    it("makes a contained row region a named Tab stop", () => {
        const { container } = render(<Root><Card isScrollable /></Root>)
        const region = container.querySelector("[data-grammar-scroll-region=\"vertical\"]")
        expect(region?.getAttribute("role")).toBe("region")
        expect(region?.getAttribute("tabindex")).toBe("0")
        expect(region?.getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { name: "Questions" }).id)
    })
})
