/**
 * TEMPLATE - `src/components/contracts/index.ts`.
 *
 * Copy this file to that path and grow the table. Everything above the table is the SCAFFOLDING and
 * is the same in every repository; the entries themselves are the repository's own vocabulary, and
 * the seed below exists only to show each feature once.
 *
 * The law this file holds is `fe/canon/patterns/contract.md`. The rules that patrol what a type
 * cannot see are in `contract.mjs`.
 *
 * WHY THIS IS A TYPE AND NOT A CONVENTION. Two of the constraints here are closed unions, so a
 * value outside them is not forbidden - it is unrepresentable. That single property is what makes a
 * whole family of patrol rules unnecessary: there is nothing to police when the bad value cannot be
 * typed, and nothing to argue about when the compiler has already refused.
 */
import type { ComponentType, ReactNode } from "react"

/**
 * What a component drawn inside a node receives. It never receives the key that placed it: the node
 * is drawn by the branch, and a child that could read the key could also disagree with it.
 *
 * Declared here rather than in `props.ts` because the component types below are built from it, and
 * this file cannot import that one without the two forming a cycle.
 */
export type InnerProps = { readonly isLoading?: boolean }

/**
 * The closed set of classes a node may lay its children out with.
 *
 * `gap-[13px]` is not forbidden - it is UNREPRESENTABLE, because it is not a member. Grow this list
 * deliberately: a new member is a decision about the house scale, and it should read as one in the
 * diff rather than arriving inside a component nobody reviewed closely.
 */
export type LayoutClassName =
    | "flex" | "grid" | "flex-col" | "flex-row" | "flex-wrap" | "relative"
    | "items-center" | "items-baseline" | "items-start"
    | "justify-between" | "justify-center" | "[&>*]:w-full"
    | "gap-1" | "gap-2" | "gap-3" | "gap-4" | "gap-6" | "gap-8"
    | "grid-cols-1" | "sm:grid-cols-2"
    | "mx-auto" | "w-full" | "text-center"
    | "px-3" | "px-4" | "py-2" | "py-3" | "py-6" | "p-0" | "p-4" | "p-6"
    | "rounded-xl" | "rounded-2xl" | "rounded-full"
    | "bg-surface" | "bg-default" | "shadow-surface"
    // Positional selectors are accepted HERE and only here - see the note on the table below.
    | "[&>*]:px-4" | "[&>*]:py-3"
    | "[&>*:first-child]:pt-4" | "[&>*:last-child]:pb-4"
    | "[&>*:first-child]:grow" | "[&>*:last-child]:grow"
    | "[&>*:nth-child(2)]:min-w-0" | "[&>*:nth-child(2)]:grow"

/**
 * The elements a node may open.
 *
 * A node is not always a `div`: a run of days IS a list, and a field with a submit IS a form, and an
 * element chosen for meaning cannot be swapped for a neutral one without changing what assistive
 * technology reports.
 *
 * THIS UNION IS LOAD-BEARING FOR A REASON THAT IS NOT OBVIOUS. Without it the frame draws only
 * `div`, so any shape needing `<ul>` has nowhere lawful to live and gets filed among the leaves
 * instead - where it may write its own classes. That is how an entire tier fills up with
 * arrangements, and the duplication is invisible afterwards because no rule reads both places.
 *
 * `main` AND `ol` WERE ADDED FROM A CONSUMING REPOSITORY, which is the part worth recording. A
 * repository had grown its own copy of this union under a different NAME - `ContractHostTag` - with
 * `main` and `ol` present and `li`, `header` and `footer` missing. Neither list contained the other,
 * so both were wrong and neither could tell: the scaffolding above the table is supposed to be
 * identical everywhere, and a renamed type is a divergence no import ever reports. The members are
 * merged here, at the source, and the repository takes this name.
 *
 * `main` is the document's one landmark. `ol` is `ul` where the sequence is the meaning - module
 * three follows module two - and it is useless without the `li` beside it, which is the trap the
 * other repository hit: it admitted both list containers and not the item, so a list row had to be
 * a `div`, which is invalid HTML and silent. A `<ul>` whose children are not `<li>` stops being
 * announced as a list at all, and nothing turns red, because a `div` is never wrong on its own.
 */
export type ContractHost =
    | "div" | "ul" | "ol" | "li" | "form" | "nav" | "main" | "section" | "header" | "footer" | "aside"

/**
 * ONE CHILD SLOT. Either the child is another node, or it is a leaf.
 *
 * A node child names a KEY, and the key is checked against this table. A leaf child cannot: a leaf
 * is not a node and has no key. It names the leaf and the props it must take, and the leaf declares
 * the same pair - so the table never imports a component, and the compiler still matches them.
 *
 * `repeats: true` says the live slot is an array. `restingCount` is separate because it is the
 * loading cardinality, not a claim about the dynamic live length.
 */
export type ChildCardinality =
    | { readonly repeats?: false; readonly restingCount?: never }
    | { readonly repeats: true; readonly restingCount: number }

export type ChildSpec = ChildCardinality & {
    readonly contract?: string | ReadonlyArray<string>
    readonly leaf?: string | ReadonlyArray<string>
    readonly props?: Readonly<Record<string, string | number | boolean | null>>
    readonly optional?: true
}

/** One entry: a node's own classes, what sits inside it, the element it opens, and why. */
export interface ContractSpec {
    /** The classes of the node itself. Not a prop, not reachable by a caller. */
    readonly classNames: ReadonlyArray<LayoutClassName>
    /**
     * WHAT SITS INSIDE THIS NODE, position by position, in the order it appears.
     *
     * THIS IS THE CHILD CONTRACT. It was a sentence in the key's name once, which meant a reader
     * could check it and nothing else could. Written as a list, every position has a type.
     *
     * A position is one of two things, and the difference is the difference between the tiers:
     *
     *   - `{ contract }`, when the child is another node. A key this table does not define is a
     *     compile error here, rather than an empty box on a screen somebody has to open to notice.
     *   - `{ leaf, props }`, when the child is a leaf. Leaves have no key, so the slot names the
     *     leaf and the props it must take instead.
     *
     * SLOTS ARE NAMED, NOT COUNTED. A record rather than a list, because a position is a fact about
     * the tree and a number is only a fact about the file: insert a child into a list and every
     * slot after it silently means something else. A name survives the insertion, reads at the call
     * site without counting, and gives the reason a thing to talk about.
     *
     * The whole tree above the leaves is therefore declared in this file, and a shape can be read
     * without opening a single component.
     */
    readonly children: { readonly [slot: string]: ChildSpec }
    /**
     * The element this node opens. Absent means `div` - the neutral box, which is most nodes.
     *
     * Stated here rather than passed by a caller: two call sites of one key that disagreed about
     * the element would be two different nodes wearing one name.
     */
    readonly host?: ContractHost
    /**
     * Why the children of this node sit the way they do, in one sentence.
     *
     * A REASON, never a restatement of the key: "a row of chips" only says the key again; "the tags
     * wrap onto their own line before the title does" is the fact that made the node exist.
     */
    readonly why: string
}

/**
 * Build the table.
 *
 * A function rather than a bare literal so the keys are checked in one place and stay literal
 * without an `as const` at the call site.
 *
 * THE CONSTRAINT IS SELF-REFERENTIAL, and that is what makes the child contract real: `children` is
 * narrowed to `keyof T`, so a child naming a key this table does not define is a compile error in
 * this file rather than an empty node on a screen somebody has to open to notice.
 */
const buildContracts = <
    const T extends {
        readonly [K in keyof T]: ContractSpec & {
            readonly children: {
                readonly [slot: string]: ChildCardinality & {
                    readonly contract?: keyof T | ReadonlyArray<keyof T>
                    readonly leaf?: string | ReadonlyArray<string>
                    readonly props?: Readonly<Record<string, string | number | boolean | null>>
                    readonly optional?: true
                }
            }
        }
    },
>(contracts: T): T => contracts

/**
 * THE TABLE. Every node the design layer may draw, and the reason each one holds its children the
 * way it does.
 *
 * KEEP THE NAMES CHILD-FIXING. A key whose name does not say what belongs inside it stops teaching
 * anything, and its reason decays into a label the moment a second screen uses it.
 *
 * THE NAME IS NO LONGER WHAT HOLDS THE CHILD CONTRACT, and that is a reversal worth recording. The
 * child map was retired once because contents arrived as markup, which a rule cannot read: a `.map`,
 * a ternary and an unnamed subtree all look identical to it. Contents arrive as COMPONENTS now, so
 * `children` states each position and the compiler checks it. The name still has a job - it is what
 * a reader sees first - but it is no longer the only fence.
 *
 * POSITIONAL SELECTORS ARE ACCEPTED HERE, and only here. Naming a child instead of counting to it
 * would be better. The objection stands - insert something in the middle and `nth-child(2)` is
 * silently wrong - but the children are now declared right here, so whoever inserts one is looking
 * at the selector while they do it.
 *
 * The entries below are a SEED, not an inventory: one row of leaves, one node holding another node,
 * one that names its host. Delete them once the repository has its own.
 */
export const CONTRACTS = buildContracts({
    "glyph-title-fact-row": {
        classNames: ["flex", "flex-row", "items-center", "gap-2", "[&>*:nth-child(2)]:min-w-0", "[&>*:nth-child(2)]:grow"],
        children: {
            glyph: { leaf: "icon", props: { size: "sm" } },
            title: { leaf: "text", props: { size: "md", tone: "default" } },
            fact: { leaf: "text", props: { size: "sm", tone: "muted" } },
        },
        why: "The glyph identifies the row faster than its name does, so it leads the line and the fact trails it - and the name between them takes the slack, because a long one must clip rather than push the figure off the end of the row.",
    },
    "heading-over-body": {
        classNames: ["flex", "flex-col", "gap-3"],
        children: {
            heading: { leaf: "heading", props: { level: 3 } },
            body: { contract: "glyph-title-fact-row" },
        },
        why: "The seam here is the only thing telling a reader that the content below belongs to this heading and not to the one above it.",
    },
    "weekday-run": {
        classNames: ["flex", "flex-row", "flex-wrap", "items-center", "gap-2"],
        children: {
            day: { leaf: "day-cell", props: { size: "sm" }, repeats: true, restingCount: 6 },
        },
        host: "ul",
        why: "A run of equal columns only reads as one span of time while the columns stay on one line, so it wraps as a whole rather than letting a single day drop away from the six beside it.",
    },
})

/** Every key in the table. A key not in this union is a compile error at the call site. */
export type ContractKey = keyof typeof CONTRACTS

/**
 * Read one entry, widened to the shared shape.
 *
 * @param name - The key to read.
 */
export const contractSpec = (name: ContractKey): ContractSpec => CONTRACTS[name]

/** Every key, in declaration order, so gates and tests can walk the vocabulary. */
export const CONTRACT_KEYS: ReadonlyArray<ContractKey> = Object.keys(CONTRACTS) as Array<ContractKey>

/** Checked named slots for one key. Content records are values, not pretend React components. */
export type ContractSlots<K extends ContractKey> = {
    readonly kind: "slots"
    readonly meta: { readonly shape: "contract"; readonly contract: K }
    readonly slots: ChildrenOf<K>
}

/** A branch-owned node that has already drawn wrapper mechanics a content contract cannot express. */
export type ContractProjection<K extends ContractKey> = {
    readonly kind: "projection"
    readonly meta: { readonly shape: "contract"; readonly contract: K }
    readonly project: () => ReactNode
}

/** A real component type whose runtime props stay separate from its exact contract identity. */
export type ContractRenderComponent<K extends ContractKey, P> = ComponentType<P> & {
    readonly kind: "component"
    readonly meta: { readonly shape: "contract"; readonly contract: K }
}

/** Checked bound content used when a caller has already supplied every slot value. */
export type BoundContractComponent<K extends ContractKey> = ContractSlots<K> | ContractProjection<K>

/** Bound content by default; supplying `P` selects the stable component-type lane. */
export type ContractComponent<K extends ContractKey, P = undefined> = [P] extends [undefined]
    ? BoundContractComponent<K>
    : ContractRenderComponent<K, P>

/**
 * A leaf, typed by its NAME and the props it takes. It has no key, because it is not a node.
 *
 * The name is what separates two leaves that happen to accept the same props: a slot asking for a
 * glyph and a slot asking for a one-word label are not interchangeable, and without the name the
 * compiler would have no way to say so.
 *
 * THE NAME LIVES ON THE COMPONENT'S OWN METADATA, beside the tier marker every component already
 * carries. As a property rather than a module export, because a module export is invisible to the
 * type of the thing being passed - and this whole arrangement is worth having only if the compiler
 * can read it at the call site.
 *
 * ```tsx
 * export const Icon = ({ props, isLoading }: IconProps) => ...
 * Icon.meta = { tier: "leaf", name: "icon" } as const
 * ```
 */
export type LeafComponent<N extends string, P> = {
    (): ReactNode
    readonly meta: { readonly shape: "leaf"; readonly name: N; readonly props: P }
}

type ContractChild<S> = S extends { readonly contract: infer K }
    ? K extends ContractKey
        ? ContractComponent<K>
        : K extends ReadonlyArray<infer A extends ContractKey> ? ContractComponent<A> : never
    : never

type LeafChild<S> = S extends { readonly leaf: infer N }
    ? (N extends ReadonlyArray<infer A> ? A : N) extends infer L extends string
        ? LeafComponent<L, S extends { readonly props: infer P } ? P : Readonly<Record<never, never>>>
        : never
    : never

type OneChild<S> = ContractChild<S> | LeafChild<S>
type ChildValue<S> = S extends { readonly repeats: true } ? ReadonlyArray<OneChild<S>> : OneChild<S>

type RequiredSlots<K extends ContractKey> = {
    [S in keyof (typeof CONTRACTS)[K]["children"]]:
        (typeof CONTRACTS)[K]["children"][S] extends { readonly optional: true } ? never : S
}[keyof (typeof CONTRACTS)[K]["children"]]

type OptionalSlots<K extends ContractKey> = Exclude<keyof (typeof CONTRACTS)[K]["children"], RequiredSlots<K>>

/**
 * The components a key requires inside it, by slot name.
 *
 * This is the child contract as the compiler sees it. A leaf of the wrong name, a leaf with the
 * wrong props, a node where the entry asked for a leaf, a missing slot and a slot the entry never
 * declared are five different compile errors at the call site rather than five things a reviewer
 * has to notice.
 */
export type ChildrenOf<K extends ContractKey> = {
    readonly [S in RequiredSlots<K>]: ChildValue<(typeof CONTRACTS)[K]["children"][S]>
} & {
    readonly [S in OptionalSlots<K>]?: ChildValue<(typeof CONTRACTS)[K]["children"][S]>
}
