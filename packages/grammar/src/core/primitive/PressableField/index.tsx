"use client"

import { Icon, type IconSource } from "../Icon/index.js"
import {
    pressableFieldClassName,
    pressableFieldContentClassName,
    pressableFieldPlaceholderClassName,
    pressableFieldShortcutClassName,
} from "./classNames.js"

export type PressableFieldProps = {
    /** Accessible name of the control; the placeholder is decoration, not a name. */
    readonly label: string
    /** Placeholder-style copy that says what pressing the field will let the reader do. */
    readonly placeholder: string
    readonly source?: IconSource
    /** Keyboard hint shown at the end of the field, rendered as a `kbd`. */
    readonly shortcut?: string
    readonly isDisabled?: boolean
    readonly onPress?: () => void
}

/**
 * A field you press instead of type into.
 *
 * It is input ANATOMY, not a button variant: the height, inset, corner, border and paint come from
 * the same `--field-*` contract `Input` reads, so a search trigger sitting beside real fields
 * matches them without any application restating field geometry. It never accepts text - the whole
 * field is one press target - so it carries its own accessible name and no form value.
 */
export const PressableField = ({ label, placeholder, source, shortcut, isDisabled = false, onPress }: PressableFieldProps) => (
    <button
        type="button"
        aria-label={label}
        disabled={isDisabled}
        data-tier="atom"
        data-component="PressableField"
        data-disabled={isDisabled ? "true" : "false"}
        data-contract="MEASURE-2 PADDING-3 GAP-2 SURFACE-4 TONE-1"
        className={pressableFieldClassName}
        onClick={() => onPress?.()}
    >
        <span className={pressableFieldContentClassName} data-contract="GAP-2">
            {source === undefined ? null : <Icon source={source} usage="leading" />}
            <span className={pressableFieldPlaceholderClassName} data-contract="FLOW-4 FONT-2 TONE-2">{placeholder}</span>
        </span>
        {shortcut === undefined ? null : <kbd className={pressableFieldShortcutClassName} data-contract="FONT-1 PADDING-1 TONE-2">{shortcut}</kbd>}
    </button>
)
