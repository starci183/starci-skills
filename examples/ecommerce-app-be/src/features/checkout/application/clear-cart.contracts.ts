/** Clearing the cart takes no input: it is the caller own cart. */
export type ClearCartRequest = Readonly<Record<string, never>>

/** The confirmation that the cart is empty now. */
export interface ClearCartResult {
    /** Always true. */
    readonly cleared: true
}
