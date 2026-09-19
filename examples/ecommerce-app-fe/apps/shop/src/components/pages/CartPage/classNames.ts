/**
 * The cart view's layout roles: one cart line's row, the row's right-hand cluster (quantity and
 * line total), and the action row under the list that carries clear-cart and the checkout door.
 */
export const cartPageClassNames = {
    row: "starci-core-static-row items-center justify-between",
    rowAside: "flex items-center gap-3",
    actions: "mt-6 flex items-center gap-3",
} as const
