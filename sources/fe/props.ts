/**
 * TEMPLATE - `src/components/contracts/props.ts`.
 *
 * Copy this file to that path unchanged. Unlike the contract table beside it, there is nothing here
 * for a repository to grow: these are the slot shapes themselves, and a repository that edits them
 * has changed the rules rather than filled them in.
 *
 * THE SLOT SHAPES, AS TYPES RATHER THAN AS A CONVENTION.
 *
 * Every component below a block takes a FIXED set of named slots and no others. Written as a type
 * alias per tier, a fourth slot is not discouraged - it does not compile, because the alias is the
 * whole shape and there is nowhere to put one.
 *
 * This is the difference between a rule and a fence. `interface XProps { props: XData; isLoading?: boolean }`
 * is a rule: correct today, and one `extends` away from carrying a `className` next month.
 * `type XProps = LeafProps<XData>` is a fence.
 */
import type { ReactNode } from "react"

/**
 * What DATA is: anything a JSON document could hold.
 *
 * A function does not satisfy it, and that is the only thing stopping a component being smuggled
 * through `props` - which is why handlers travel in their own slot rather than beside the data.
 *
 * NOTE FOR AUTHORS: a component's data must be declared with `type`, not `interface`. TypeScript
 * gives an implicit index signature to a type alias and not to an interface, so an interface
 * silently fails this constraint. That is not a quirk to work around - it is the constraint doing
 * its job.
 */
export type DataValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | ReadonlyArray<DataValue>
    | { readonly [key: string]: DataValue }

/** The shape any component's data must have: data all the way down. */
export type ComponentData = { readonly [key: string]: DataValue }

/** The shape any component's handlers must have: functions, kept apart from the data. */
export type ComponentActions = { readonly [key: string]: ((...args: Array<never>) => void) | undefined }

/**
 * A LEAF's props. Three slots, no fourth.
 *
 * `props` - what it draws. `on` - what it does. `isLoading` - handed down, never decided here.
 * No `children`: only a branch assembles. No `className`: a caller who can restyle a node has
 * become its second owner, and the component now has two authors who never speak.
 */
export type LeafProps<D extends ComponentData, A extends ComponentActions = ComponentActions> = {
    readonly props: D
    readonly on?: A
    readonly isLoading?: boolean
}

/**
 * A COMPOSITE's props. The same three slots a leaf has, and the absence of a fourth is the point.
 *
 * A composite is a CLOSED shape: it assembles leaves into an arrangement a caller can use but
 * cannot rearrange. That boundary with `branch` is held by this type rather than by a convention -
 * there is no `children` here, so an author who wanted a slot cannot express one and has to decide
 * which tier they are actually writing. A boundary the compiler holds does not drift.
 *
 * It is structurally identical to {@link LeafProps} and deliberately NOT an alias of it: the two
 * tiers answer different questions, and a shared name would let a reader conclude they are the same
 * kind of thing. What separates them is what the file may DO, not what it may accept.
 */
export type CompositeProps<D extends ComponentData, A extends ComponentActions = ComponentActions> = {
    readonly props: D
    readonly on?: A
    readonly isLoading?: boolean
}

/**
 * A BRANCH's props. Same three, plus the one thing that makes it a branch: it assembles, so it
 * takes what goes inside.
 */
export type BranchProps<D extends ComponentData, A extends ComponentActions = ComponentActions> = {
    readonly props: D
    readonly on?: A
    readonly children?: ReactNode
    readonly isLoading?: boolean
}

/**
 * A BLOCK's presentational half. Two slots.
 *
 * `state` is the business situation and it picks a tree; `props` is what that tree says. There is
 * no `isLoading` here - a block WRITES the flag when it hands a tree down, and never receives one.
 * The type is a union per state at the call site, so the data of a situation a surface is NOT in
 * cannot be passed, and the data of the one it IS in cannot be omitted.
 */
export type BlockProps<S extends string, D extends ComponentData> = {
    readonly state: S
    readonly props: D
}
