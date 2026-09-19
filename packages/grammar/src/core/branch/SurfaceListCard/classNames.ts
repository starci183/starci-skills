import { cn } from "@heroui/react"

/**
 * Surface-list geometry is SHIPPED: `.starci-core-surface-list*`, `.starci-core-list-shell`,
 * `.starci-core-surface-fact` and `.starci-core-owned-collection` in `src/common/styles.css` own
 * the box, the fact's scale and the collection's corner. The fact's depth and the verdict corner
 * are selected there by `data-grammar-surface-depth` and `data-grammar-collection`, which the
 * component emits.
 */

/** Identifies the outer surface-list anatomy. */
export const surfaceListClassName = cn("starci-core-surface-list") ?? "starci-core-surface-list"
/** Identifies the external label row shared by surface branches. */
export const surfaceLabelClassName = cn("starci-core-surface-label") ?? "starci-core-surface-label"
/** Keeps the peer fact at the same visual level as its owning label. */
export const surfaceFactClassName = cn("starci-core-surface-fact") ?? "starci-core-surface-fact"
/** Identifies the list's bounded surface shell. */
export const listShellClassName = cn("starci-core-surface", "starci-core-list-shell") ?? "starci-core-surface starci-core-list-shell"
/** Identifies the optional footer region. */
export const surfaceFooterClassName = cn("starci-core-surface-footer") ?? "starci-core-surface-footer"
/** Identifies the collection region shared by verdict and ordinary lists. */
export const collectionClassName = cn("starci-core-owned-collection") ?? "starci-core-owned-collection"
