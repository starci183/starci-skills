import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Progress } from "./index.js"

describe("Core Progress", () => {
    it("exposes an accessible measurement with its exact resolved value", () => {
        const markup = renderToStaticMarkup(<Progress label="Course completion" value={42} />)

        expect(markup).toContain("data-component=\"Progress\"")
        expect(markup).toContain("data-loading=\"false\"")
        expect(markup).toContain("aria-label=\"Course completion\"")
        expect(markup).toContain("aria-valuenow=\"42\"")
        expect(markup).toContain("aria-valuemin=\"0\"")
        expect(markup).toContain("aria-valuemax=\"100\"")
    })

    it("uses an inert shape for initial loading instead of announcing false progress", () => {
        const markup = renderToStaticMarkup(<Progress label="Course completion" isSkeleton />)

        expect(markup).toContain("data-loading=\"true\"")
        expect(markup).toContain("aria-hidden=\"true\"")
        expect(markup).toContain("starci-core-progress")
        expect(markup).not.toContain("progressbar")
        expect(markup).not.toContain("Course completion")
    })
})
