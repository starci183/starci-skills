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
import type { ContractComponent, ContractKey } from "./index"

export type { InnerProps } from "./index"

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
 * No `render`: only a branch assembles. No `className`: a caller who can restyle a node has
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
 * there is no `render` here, so an author who wanted a slot cannot express one and has to decide
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
 * A BRANCH's props. The same three a leaf has, plus the key it draws and the components that fill
 * the slots that key declares.
 *
 * THIS IS THE SLOT THAT USED TO BE `children`, AND THE CHANGE IS NOT COSMETIC. `children` is markup
 * that has already been built: it can be a `.map`, a ternary, a fragment, or a subtree nobody named,
 * so nothing above it can say what is inside a node and no rule can check. `render` is a contract
 * component carrying a typed RECORD OF COMPONENTS, one per slot the entry declares. That is
 * what lets the table state what belongs in each position and have the claim be worth something.
 *
 * `contract` and `render` are one decision written twice, and `ContractComponent<K>` ties them together:
 * the key fixes which slots exist and what may fill each, so a card cannot say one thing and hold
 * another. A wrong leaf, wrong leaf props, a node where a leaf was asked for, a missing slot and a
 * slot nobody declared are five compile errors rather than five things a reviewer has to spot.
 *
 * Runtime data may be closed over by the typed builder at the call site. What may not arrive is a
 * bare callback or JSX value with no contract/leaf metadata, because that erases the slot identity.
 *
 * THERE IS NO LIST VARIANT, and there does not need to be. A slot that holds many says so in the
 * table with `repeats: true`; that slot becomes an array. `restingCount` separately fixes how many
 * placeholders draw while loading, because live length is dynamic and is not the skeleton count.
 */
export type BranchProps<
    D extends ComponentData,
    K extends ContractKey,
    A extends ComponentActions = ComponentActions,
> = {
    readonly props: D
    readonly on?: A
    readonly contract: K
    readonly render: ContractComponent<NoInfer<K>>
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
