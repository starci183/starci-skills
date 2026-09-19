import { renderToStaticMarkup } from "react-dom/server"
import type { ComponentProps } from "react"
import { describe, expect, it } from "vitest"
import {
    CORE_GRAMMAR_COMPONENTS,
    defineGrammarFamily,
    type GrammarComponentRenderer,
} from "./index.js"

describe("@starci/grammar/core family registry", () => {
    it("registers the public Common renderer surface", () => {
        expect(Object.keys(CORE_GRAMMAR_COMPONENTS)).toEqual(expect.arrayContaining([
            "GrammarRoot",
            "Button",
            "Heading",
            "Sidebar",
            "TextAction",
            "WorkspaceShell",
        ]))
        expect(CORE_GRAMMAR_COMPONENTS).not.toHaveProperty("DashboardShell")
        expect(Object.isFrozen(CORE_GRAMMAR_COMPONENTS)).toBe(true)
    })

    it("resolves a props-compatible replacement and a declared extension", () => {
        const ReplacementHeading: GrammarComponentRenderer<
            ComponentProps<typeof CORE_GRAMMAR_COMPONENTS.Heading>
        > = (props) => <CORE_GRAMMAR_COMPONENTS.Heading {...props} />
        const Brand = ({ name }: { readonly name: string }) => <span>{name}</span>
        const family = defineGrammarFamily({
            id: "heritage",
            styles: {
                entrypoint: "@starci/grammar/heritage/styles.css",
                scope: { attribute: "data-grammar-family", value: "heritage" },
            },
            components: {
                replacements: { Heading: ReplacementHeading },
                extensions: { Brand },
            },
        })

        const FamilyHeading = family.components.Heading
        const FamilyBrand = family.components.Brand
        const markup = renderToStaticMarkup(<>
            <FamilyHeading level={2}>Title</FamilyHeading>
            <FamilyBrand name="House" />
        </>)

        expect(markup).toContain("<h2")
        expect(markup).toContain("Title")
        expect(markup).toContain("House")
        expect(family.scopeProps).toEqual({ "data-grammar-family": "heritage" })
    })

    it("rejects invalid runtime definitions", () => {
        const renderer = () => null
        const styles = {
            entrypoint: "@starci/grammar/heritage/styles.css" as const,
            scope: { attribute: "data-grammar-family" as const, value: "heritage" },
        }

        expect(() => defineGrammarFamily({
            id: "other",
            styles,
            components: { replacements: {}, extensions: {} },
        })).toThrow(/scope must match/)
        expect(() => defineGrammarFamily({
            id: "heritage",
            styles,
            components: { replacements: { Unknown: renderer } as never, extensions: {} },
        })).toThrow(/unknown Common component/)
        expect(() => defineGrammarFamily({
            id: "heritage",
            styles,
            components: { replacements: {}, extensions: { Button: renderer } as never },
        })).toThrow(/collides with Common component/)
    })
})
