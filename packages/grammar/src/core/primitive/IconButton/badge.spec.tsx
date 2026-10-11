import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { IconButton, iconButtonBadgeText } from "./index.js"

const Glyph = () => <svg />

describe("IconButton badge", () => {
    it("caps numbers, hides zero and empty", () => {
        expect(iconButtonBadgeText(undefined)).toBeNull()
        expect(iconButtonBadgeText(0)).toBeNull()
        expect(iconButtonBadgeText("")).toBeNull()
        expect(iconButtonBadgeText(7)).toBe("7")
        expect(iconButtonBadgeText(240)).toBe("99+")
        expect(iconButtonBadgeText(12, 9)).toBe("9+")
        expect(iconButtonBadgeText("New")).toBe("New")
    })

    it("pins a decorative plate and announces the count through the name", () => {
        const html = renderToStaticMarkup(<IconButton source={Glyph} label="Notifications" badge={3} badgeLabel="3 unread" />)
        expect(html).toContain('aria-label="Notifications, 3 unread"')
        expect(html).toContain('data-grammar-icon-button-badge="present"')
        expect(html).toMatch(/<span aria-hidden="true" class="starci-core-icon-button-badge"[^>]*>3<\/span>/)
    })

    it("draws nothing for no count or while loading", () => {
        expect(renderToStaticMarkup(<IconButton source={Glyph} label="Bell" badge={0} />)).toContain('data-grammar-icon-button-badge="none"')
        const loading = renderToStaticMarkup(<IconButton source={Glyph} label="Bell" badge={4} badgeLabel="4" isSkeleton />)
        expect(loading).not.toContain('class="starci-core-icon-button-badge"')
        expect(loading).toContain('aria-label="Bell"')
    })
})
