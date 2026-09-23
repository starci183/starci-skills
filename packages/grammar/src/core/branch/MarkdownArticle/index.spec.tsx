// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { GRAMMAR_ROOT_CASES, expectInFamilyScope } from "../../../__test__/grammarRoots.js"
import { FencedCodeBlock, MarkdownTableFrame } from "./index.js"

afterEach(cleanup)

describe.each(GRAMMAR_ROOT_CASES)("Common Markdown scroll frames under $name", ({ Root, family }) => {
    it("makes authored code a keyboard-reachable region named by its label or language", () => {
        render(<Root>
            <FencedCodeBlock code="npm install" language="bash" />
            <FencedCodeBlock code="x = 1" label="Assignment" />
        </Root>)
        const bash = screen.getByRole("region", { name: "bash" })
        expect(bash.tagName).toBe("PRE")
        expect(bash.getAttribute("tabindex")).toBe("0")
        expect(screen.getByRole("region", { name: "Assignment" }).getAttribute("tabindex")).toBe("0")
        expectInFamilyScope(bash, family)
    })

    it("keeps an unnamed code block reachable without inventing a region", () => {
        const { container } = render(<Root><FencedCodeBlock code="plain" /></Root>)
        const pre = container.querySelector("pre")
        expect(pre?.getAttribute("tabindex")).toBe("0")
        expect(pre?.hasAttribute("role")).toBe(false)
    })

    it("makes a table frame a Tab stop, and a named region when labelled", () => {
        render(<Root><MarkdownTableFrame label="Verb forms"><table><tbody><tr><td>go</td></tr></tbody></table></MarkdownTableFrame></Root>)
        expect(screen.getByRole("region", { name: "Verb forms" }).getAttribute("tabindex")).toBe("0")
    })
})
