export type LeadingNumberProps = {
    /** One-based position of the item inside its authored sequence. */
    readonly position: number
}

import { leadingNumberClassName } from "./classNames.js"

/**
 * Product-neutral ordinal prefix for readable ordered rows.
 *
 * The punctuation and treatment are intentionally closed: an ordinal prefix is
 * quiet reading structure (`1.`), never a badge, chip, status, or decoration.
 */
export const LeadingNumber = (props: LeadingNumberProps) => (
    <span
        className={leadingNumberClassName}
    >
        {props.position}.
    </span>
)
