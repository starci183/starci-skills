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
    | "gap-2" | "gap-3" | "gap-4" | "gap-6" | "gap-8"
    | "grid-cols-1" | "sm:grid-cols-2"
    | "mx-auto" | "w-full" | "text-center"
    | "px-3" | "px-4" | "py-2" | "py-3" | "py-6" | "p-4" | "p-6"
    | "rounded-xl" | "rounded-2xl" | "rounded-full"
    | "bg-surface" | "bg-default" | "shadow-surface"
    // Positional selectors are accepted HERE and only here - see the note on the table below.
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
 */
export type ContractHost = "div" | "ul" | "li" | "form" | "nav" | "section" | "header" | "footer" | "aside"

/** One entry: a node's own classes, the element it opens, and why what it holds sits that way. */
export interface ContractSpec {
    /** The class string of the node itself. Not a prop, not reachable by a caller. */
    readonly classes: ReadonlyArray<LayoutClassName>
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
 */
const buildContracts = <const T extends { readonly [K in keyof T]: ContractSpec }>(contracts: T): T => contracts

/**
 * THE TABLE. Every node the design layer may draw, and the reason each one holds its children the
 * way it does.
 *
 * KEEP THE NAMES CHILD-FIXING. A key whose name does not say what belongs inside it stops
 * constraining anything, and its reason decays into a label the moment a second screen uses it.
 * Since the child map was retired the NAME is the only thing holding the child contract - a rule
 * cannot check what goes inside a node, and a reader can only if the name tells them.
 *
 * POSITIONAL SELECTORS ARE ACCEPTED HERE, and only here. Naming a child instead of counting to it
 * would be better. The objection stands - insert something in the middle and `nth-child(2)` is
 * silently wrong - but the children come from ONE branch, so whoever inserts one is looking at this
 * file beside it.
 *
 * The three entries below are a SEED, not an inventory: one plain node, one that names its host,
 * one that reaches for a positional selector. Delete them once the repository has its own.
 */
export const CONTRACTS = buildContracts({
    "heading-over-body": {
        classes: ["flex", "flex-col", "gap-4"],
        why: "The seam here is the only thing telling a reader that the content below belongs to this heading and not to the one above it.",
    },
    "weekday-run": {
        classes: ["flex", "flex-row", "flex-wrap", "items-center", "gap-2"],
        host: "ul",
        why: "A run of equal columns only reads as one span of time while the columns stay on one line, so it wraps as a whole rather than letting a single day drop away from the six beside it.",
    },
    "glyph-title-fact-row": {
        classes: ["flex", "flex-row", "items-center", "gap-3", "[&>*:nth-child(2)]:min-w-0", "[&>*:nth-child(2)]:grow"],
        why: "The glyph identifies the row faster than its name does, so it leads the line and the fact trails it - and the name between them takes the slack, because a long one must clip rather than push the figure off the end of the row.",
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
