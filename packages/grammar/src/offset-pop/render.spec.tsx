import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { offsetPopGrammar } from "./index.js"

describe("Offset Pop inherited Common render integration", () => {
    it("renders treatment hooks through public components without consumer-authored attributes", () => {
        const {
            Badge,
            Button,
            GrammarRoot,
            Heading,
            Rail,
            StaticStateRow,
            SurfaceCard,
            SurfaceListCard,
            Text,
        } = offsetPopGrammar.components

        const markup = renderToStaticMarkup(
            <GrammarRoot>
                <Heading level={1} scale="display">Offset Pop</Heading>
                <Text tone="muted">Supporting copy</Text>
                <Badge tone="accent">New</Badge>
                <Button variant="primary">Continue</Button>
                <SurfaceCard label="Overview" wholeAction={{ kind: "link", href: "/overview", label: "Open overview" }}>
                    Content
                </SurfaceCard>
                <SurfaceListCard label="States">
                    <StaticStateRow item={{ id: "ready", label: "Ready", state: "affirmative" }} />
                </SurfaceListCard>
                <Rail label="Details">Rail content</Rail>
            </GrammarRoot>,
        )

        expect(markup).toContain("data-grammar-family=\"offset-pop\"")
        expect(markup).toContain("data-component=\"Heading\"")
        expect(markup).toContain("data-scale=\"display\"")
        expect(markup).toContain("data-component=\"Text\"")
        expect(markup).toContain("data-tone=\"muted\"")
        expect(markup).toContain("data-component=\"Badge\"")
        expect(markup).toContain("data-component=\"Button\"")
        expect(markup).toContain("data-grammar-surface-card=\"true\"")
        expect(markup).toContain("data-grammar-frame=\"bounded\"")
        expect(markup).toContain("data-slot=\"card\"")
        expect(markup).toContain("data-slot=\"card-header\"")
        expect(markup).toContain("data-slot=\"card-content\"")
        expect(markup.indexOf("data-slot=\"card-header\"")).toBeLessThan(
            markup.indexOf("data-slot=\"card-content\""),
        )
        expect(markup).toContain("data-grammar-whole-action=\"link\"")
        expect(markup).toContain("data-grammar-surface=\"true\"")
        expect(markup).toContain("data-grammar-list=\"true\"")
        expect(markup).toContain("data-grammar-row=\"true\"")
        expect(markup).toContain("data-grammar-state=\"affirmative\"")
        expect(markup).toContain("data-grammar-state-mark=\"check\"")
        expect(markup).toContain("data-grammar-rail=\"true\"")
    })
})
