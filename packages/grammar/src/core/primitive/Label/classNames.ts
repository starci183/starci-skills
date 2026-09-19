import { cn } from "@heroui/react"

/**
 * Identifies surface label copy. The scale that recedes when the owner is nested is SHIPPED by
 * `.starci-core-label[data-grammar-label-depth]` in `src/common/styles.css`, read from the
 * attribute the component already emits.
 */
export const getLabelClassName = () => cn("starci-core-label") ?? "starci-core-label"

/**
 * Rule ids this element can claim from the shipped rule above.
 * The nested and top scales match FONT-1 and FONT-2 on the closed type scale
 * (font.md `## Scale`). The semibold weight and the zero measure floor carry no
 * rule id in their topic files and stay unclaimed.
 * `.starci-core-label { margin: 0 }` (common/styles.css) is unconditional across both
 * depths and matches margin.md's "Label | 0 | MARGIN-0" row.
 */
export const getLabelContract = (depth: "top" | "nested") => depth === "nested" ? "FONT-1 MARGIN-0" : "FONT-2 MARGIN-0"
