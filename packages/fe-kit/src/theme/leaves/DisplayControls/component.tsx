"use client"

import { TextAction } from "@starci/grammar/common"
import { DISPLAY_CONTROLS_FRAME_CLASS_NAME } from "./classNames"

/** The pure twin's props: both commands fully resolved - copy and the press handlers. */
export type DisplayControlsBaseProps = {
    /** The row's accessible name. */
    readonly label: string;
    /** What the theme command says (`toLight`/`toDark`, resolved against the painted theme). */
    readonly themeLabel: string;
    /** What the locale command says (the OTHER language's display name). */
    readonly localeLabel: string;
    /** Flips the persisted theme between light and dark. */
    readonly onThemePress: () => void;
    /** Re-prefixed the current route into the other locale. */
    readonly onLocalePress: () => void;
};

/**
 * The two reader-facing utilities every app chrome offers, drawn as grammar `TextAction`
 * commands (`onPress`), never as links: neither is a destination. Pure: the factory-bound index
 * resolves theme, locale and copy; this half draws the row.
 */
export const DisplayControlsBase = (props: DisplayControlsBaseProps) => (
    <span className={DISPLAY_CONTROLS_FRAME_CLASS_NAME} aria-label={props.label}>
        <TextAction appearance="muted" onPress={props.onThemePress}>
            {props.themeLabel}
        </TextAction>
        <TextAction appearance="muted" onPress={props.onLocalePress}>
            {props.localeLabel}
        </TextAction>
    </span>
)
