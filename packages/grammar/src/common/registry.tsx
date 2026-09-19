"use client"

import {
    Badge, Button, ChatWorkspace, Divider, EmptyNotice, FencedCodeBlock, GrammarRoot,
    Heading, HorizontalScrollRegion, Icon, IconButton, IconTile, IncludedMark, Input,
    Label, LeadingNumber, MarkdownArticle, MarkdownTableFrame, MediaFrame,
    NavigationFeatureNav, OtpInput, PageContainer, PressableField, PrimaryRailLayout,
    Progress, Rail, RankArtwork, SectionHeader, Sidebar, StateMark, StaticStateRow, Subnav,
    SurfaceAccordionCard, SurfaceCard, SurfaceCopyGroup, SurfaceListCard, Tabs, Text,
    TextAction, Tooltip, VerticalScrollRegion, WorkspaceShell,
} from "./renderers.js"
import type { ComponentProps, ComponentType, ElementType } from "react"

export type GrammarComponentRenderer<Props> = ComponentType<Props>
type GrammarRendererRegistry = Readonly<Record<string, ElementType>>
type CompatibleReplacements<Common extends GrammarRendererRegistry> = {
    readonly [Name in keyof Common]?: GrammarComponentRenderer<ComponentProps<Common[Name]>>
}
type ExtensionWithoutCommonCollisions<Common extends GrammarRendererRegistry, Extensions extends GrammarRendererRegistry> =
    Extensions & { readonly [Name in Extract<keyof Extensions, keyof Common>]: never }

export const COMMON_GRAMMAR_COMPONENTS = Object.freeze({
    Badge, Button, ChatWorkspace, Divider, EmptyNotice, FencedCodeBlock, GrammarRoot,
    Heading, HorizontalScrollRegion, Icon, IconButton, IconTile, IncludedMark, Input,
    Label, LeadingNumber, MarkdownArticle, MarkdownTableFrame, MediaFrame,
    NavigationFeatureNav, OtpInput, PageContainer, PressableField, PrimaryRailLayout,
    Progress, Rail, RankArtwork, SectionHeader, Sidebar, StateMark, StaticStateRow, Subnav,
    SurfaceAccordionCard, SurfaceCard, SurfaceCopyGroup, SurfaceListCard, Tabs, Text,
    TextAction, Tooltip, VerticalScrollRegion, WorkspaceShell,
} as const)
export type CommonGrammarComponentName = keyof typeof COMMON_GRAMMAR_COMPONENTS

export type GrammarFamilyStyles<FamilyId extends string> = {
    readonly entrypoint: `@starci/grammar/${string}/styles.css`
    readonly scope: { readonly attribute: "data-grammar-family"; readonly value: FamilyId }
}

export type GrammarFamilyContract<FamilyId extends string, Extensions extends GrammarRendererRegistry> = {
    readonly id: FamilyId
    readonly styles: GrammarFamilyStyles<FamilyId>
    readonly components: Readonly<typeof COMMON_GRAMMAR_COMPONENTS & Extensions>
    readonly scopeProps: Readonly<{ "data-grammar-family": FamilyId }>
}

/** Define one visual family over the stable Common semantic contract. */
export const defineGrammarFamily = <
    const FamilyId extends string,
    const Replacements extends CompatibleReplacements<typeof COMMON_GRAMMAR_COMPONENTS>,
    const Extensions extends GrammarRendererRegistry,
>(definition: {
    readonly id: FamilyId
    readonly styles: GrammarFamilyStyles<FamilyId>
    readonly components: {
        readonly replacements: Replacements
        readonly extensions: ExtensionWithoutCommonCollisions<typeof COMMON_GRAMMAR_COMPONENTS, Extensions>
    }
}): GrammarFamilyContract<FamilyId, Extensions> => {
    if (definition.styles.scope.value !== definition.id) {
        throw new TypeError("Grammar family CSS scope must match the family id")
    }
    for (const name of Object.keys(definition.components.replacements)) {
        if (!(name in COMMON_GRAMMAR_COMPONENTS)) throw new TypeError(`Cannot replace unknown Common component: ${name}`)
    }
    for (const name of Object.keys(definition.components.extensions)) {
        if (name in COMMON_GRAMMAR_COMPONENTS) throw new TypeError(`Grammar extension collides with Common component: ${name}`)
    }
    const mergedComponents: Record<string, ElementType> = {}
    Object.assign(
        mergedComponents,
        COMMON_GRAMMAR_COMPONENTS,
        definition.components.replacements,
        definition.components.extensions,
    )
    return Object.freeze({
        id: definition.id,
        styles: Object.freeze({ entrypoint: definition.styles.entrypoint, scope: Object.freeze({ ...definition.styles.scope }) }),
        components: Object.freeze(mergedComponents) as unknown as Readonly<typeof COMMON_GRAMMAR_COMPONENTS & Extensions>,
        scopeProps: Object.freeze({ "data-grammar-family": definition.id }),
    })
}
