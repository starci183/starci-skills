/** @vitest-environment jsdom */
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { COMMON_GRAMMAR_COMPONENTS } from "../common/index.js"
import { installDomShims } from "../__test__/grammarRoots.js"
import { MarkdownArticle, FencedCodeBlock, MarkdownTableFrame } from "./branch/MarkdownArticle/index.js"
import { Rail } from "./branch/Rail/index.js"
import { SurfaceCard } from "./branch/SurfaceCard/index.js"
import { SurfaceListCard } from "./branch/SurfaceListCard/index.js"
import { Tooltip } from "./branch/Tooltip/index.js"
import { HorizontalScrollRegion } from "./composite/HorizontalScrollRegion/index.js"
import { StaticStateRow } from "./composite/StaticStateRow/index.js"
import { VerticalScrollRegion } from "./composite/VerticalScrollRegion/index.js"
import { PrimaryRailLayout } from "./composition/PrimaryRailLayout/index.js"
import { LeadingNumber } from "./LeadingNumber.js"
import { GrammarRoot } from "./primitive/GrammarRoot/index.js"
import { IncludedMark } from "./primitive/IncludedMark/index.js"
import { Label } from "./primitive/Label/index.js"
import { MediaFrame } from "./primitive/MediaFrame/index.js"
import { PageContainer } from "./primitive/PageContainer/index.js"
import { RankArtwork } from "./primitive/RankArtwork/index.js"
import { SectionHeader } from "./primitive/SectionHeader/index.js"
import { SurfaceCopyGroup } from "./primitive/SurfaceCopyGroup/index.js"
import { StateMark } from "./StateMark.js"

installDomShims()
afterEach(cleanup)

const here = dirname(fileURLToPath(import.meta.url))
const commonDir = resolve(here, "../common")
const TIERS = new Set(["atom", "composite", "branch", "composition"])

/** name -> the module file the Common barrels export it from. */
const moduleOf = (): Map<string, string> => {
    const out = new Map<string, string>()
    for (const barrel of ["renderers.ts", "renderers-forms.ts", "renderers-overlays.ts", "renderers-navigation.ts"]) {
        const source = readFileSync(resolve(commonDir, barrel), "utf8")
        for (const match of source.matchAll(/export \{([^}]*)\} from "([^"]+)"/g)) {
            const target = resolve(commonDir, (match[2] ?? "").replace(/\.js$/, ""))
            const file = [`${target}.tsx`, `${target}.ts`, resolve(target, "index.tsx")].find((candidate) => existsSync(candidate))
            if (file === undefined) continue
            for (const name of (match[1] ?? "").split(",").map((part) => part.trim()).filter((part) => /^[A-Z]\w*$/.test(part))) out.set(name, file)
        }
    }
    return out
}

/**
 * Every renderer the Common registry publishes names itself on the DOM (0.6.0): its root carries
 * `data-component="<Name>"` and a `data-tier`, so a drawing, a test or an audit identifies every grammar
 * component from the rendered DOM without a hand-kept selector map.
 */
describe("every registry renderer stamps data-component and data-tier", () => {
    const modules = moduleOf()

    it.each(Object.keys(COMMON_GRAMMAR_COMPONENTS))("%s", (name) => {
        const file = modules.get(name)
        expect(file, `${name} is not exported by a Common barrel`).toBeTruthy()
        const source = readFileSync(file!, "utf8")
        expect(source, `${name} never emits data-component="${name}"`).toMatch(new RegExp(`data-component(?:"\\s*:\\s*|=)"${name}"`))
        const tiers = [...source.matchAll(/data-tier(?:"\s*:\s*|=)"([a-z]+)"/g)].map((match) => match[1] ?? "")
        expect(tiers.length, `${name} emits no data-tier`).toBeGreaterThan(0)
        for (const tier of tiers) expect(TIERS.has(tier), `${name} tier ${tier}`).toBe(true)
    })
})


describe("the components that emitted none now name themselves in the DOM", () => {
    it.each([
        ["PageContainer", <PageContainer>Body</PageContainer>],
        ["SectionHeader", <SectionHeader title="Title" />],
        ["SurfaceCard", <SurfaceCard ariaLabel="Card"><p>Body</p></SurfaceCard>],
        ["SurfaceListCard", <SurfaceListCard label="List"><li>Row</li></SurfaceListCard>],
        ["MediaFrame", <MediaFrame><img alt="" src="/a.png" /></MediaFrame>],
        ["SurfaceCopyGroup", <SurfaceCopyGroup>Copy</SurfaceCopyGroup>],
        ["RankArtwork", <RankArtwork kind="gold" />],
        ["Label", <Label>Name</Label>],
        ["HorizontalScrollRegion", <HorizontalScrollRegion aria-label="Wide">Wide</HorizontalScrollRegion>],
        ["VerticalScrollRegion", <VerticalScrollRegion isScrollable aria-label="Tall">Tall</VerticalScrollRegion>],
        ["Rail", <Rail label="Evidence">Facts</Rail>],
        ["MarkdownArticle", <MarkdownArticle><p>Body</p></MarkdownArticle>],
        ["FencedCodeBlock", <FencedCodeBlock code="const a = 1" />],
        ["MarkdownTableFrame", <MarkdownTableFrame><table><tbody><tr><td>Cell</td></tr></tbody></table></MarkdownTableFrame>],
        ["IncludedMark", <IncludedMark />],
        ["Tooltip", <Tooltip content="Hint"><button type="button">?</button></Tooltip>],
        ["StaticStateRow", <ul><StaticStateRow item={{ id: "a", label: "Row" }} /></ul>],
        ["PrimaryRailLayout", <PrimaryRailLayout primary={<p>Main</p>} />],
        ["LeadingNumber", <LeadingNumber position={1} />],
        ["StateMark", <StateMark state="affirmative" />],
        ["GrammarRoot", <GrammarRoot><span>Body</span></GrammarRoot>],
    ] as const)("%s", (name, element) => {
        const { container } = render(<>{element}</>)
        expect(container.querySelector(`[data-component="${name}"]`), name).toBeTruthy()
    })
})
