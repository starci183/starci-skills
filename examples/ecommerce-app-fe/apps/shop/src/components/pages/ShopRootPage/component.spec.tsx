import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import { ShopRootPageBase, type ShopRootPageBaseProps } from "./component"

const redirecting: ShopRootPageBaseProps = {
    state: "redirecting",
    props: {},
    on: {},
}

describe("ShopRootPageBase", () => {
    it("draws nothing: the root owns no screen of its own, so the reader never sees a half page", () => {
        const { container } = render(<ShopRootPageBase {...redirecting} />)

        expect(container).toBeEmptyDOMElement()
    })
})
