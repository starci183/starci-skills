import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Image } from "./primitive/Image/index.js"
import { PrimaryRailLayout } from "./composition/PrimaryRailLayout/index.js"

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
const css = read("../common/styles.css") + read("../common/components-navigation.css")

const CLIENT_MODULES = [
    "branch/SurfaceCard/index.tsx", "branch/SurfaceListCard/index.tsx", "branch/SurfaceAccordionCard/index.tsx",
    "branch/Dialog/index.tsx", "branch/AlertDialog/index.tsx", "branch/Drawer/index.tsx", "branch/Rail/index.tsx",
    "branch/Subnav/index.tsx", "branch/Tooltip/index.tsx", "composite/Alert/index.tsx", "composite/FillViewport/index.tsx",
    "primitive/Textarea/index.tsx",
]

describe("0.9.0 additions", () => {
    it("PrimaryRailLayout mirrors its tracks for a leading rail", () => {
        const html = renderToStaticMarkup(<PrimaryRailLayout railPosition="leading" primary={<p>a</p>} rail={<p>b</p>} />)
        expect(html).toContain('data-grammar-layout-rail-position="leading"')
        expect(renderToStaticMarkup(<PrimaryRailLayout primary={<p>a</p>} />)).toContain('data-grammar-layout-rail-position="trailing"')
        expect(css).toContain('[data-grammar-layout-rail-position="leading"] > .starci-core-rail-region { order: -1; }')
    })

    it("Image can drop its plate for cut-out art", () => {
        expect(renderToStaticMarkup(<Image src="/a.png" alt="" plate="none" />)).toContain('data-grammar-image-plate="none"')
        expect(renderToStaticMarkup(<Image src="/a.png" alt="" />)).toContain('data-grammar-image-plate="default"')
        expect(css).toContain('.starci-core-image[data-grammar-image-plate="none"] { background: transparent; }')
    })

    it.each(CLIENT_MODULES)("%s is a client module, so a React Server Component can render it", (path) => {
        expect(read(`./${path}`).startsWith('"use client"')).toBe(true)
    })
})
