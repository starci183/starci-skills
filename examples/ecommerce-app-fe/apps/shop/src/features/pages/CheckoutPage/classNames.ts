/**
 * The checkout view's layout roles: one summary line's row, the row's right-hand cluster (line
 * total), and the action row that carries the confirm affordance.
 */
export const checkoutPageClassNames = {
    row: "starci-core-static-row items-center justify-between",
    rowAside: "flex items-center gap-3",
    actions: "mt-6 flex items-center gap-3",
} as const
