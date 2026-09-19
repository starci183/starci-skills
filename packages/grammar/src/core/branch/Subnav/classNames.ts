import { cn } from "@heroui/react"

/**
 * Subnav geometry is SHIPPED.
 *
 * The bar's height, separator, ground, inset and rhythm live in `.starci-core-subnav*` in
 * `src/common/styles.css`, and its two projections - sticky and compact - are selected there by
 * `data-grammar-subnav-position` and `data-grammar-subnav-visibility`, which the component already
 * emits. There is no variant class here, because a variant spelled as a utility only exists where a
 * consumer's Tailwind build happened to scan this package.
 */

export const subnavClassName = cn("starci-core-subnav") ?? "starci-core-subnav"
export const subnavIdentityClassName = cn("starci-core-subnav-identity") ?? "starci-core-subnav-identity"
export const subnavLeadingClassName = cn("starci-core-subnav-leading") ?? "starci-core-subnav-leading"
export const subnavTitleClassName = cn("starci-core-subnav-title") ?? "starci-core-subnav-title"
export const subnavToggleClassName = cn("starci-core-subnav-toggle") ?? "starci-core-subnav-toggle"
