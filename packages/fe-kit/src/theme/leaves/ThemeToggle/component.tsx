"use client"

import type { ThemeChoice } from "../../theme-context"
import {
    THEME_TOGGLE_GROUP_CLASS_NAME,
    THEME_TOGGLE_OPTION_CLASS_NAME,
    THEME_TOGGLE_PLAIN_CLASS_NAME,
} from "./classNames"

const THEME_CHOICES: ReadonlyArray<ThemeChoice> = ["light", "dark", "system"]

/** The copy the connected half resolved, keyed by what the group announces and each choice says. */
export type ThemeToggleLabels = {
    /** The group's accessible name. */
    readonly group: string;
    /** Label for the `light` choice. */
    readonly light: string;
    /** Label for the `dark` choice. */
    readonly dark: string;
    /** Label for the `system` choice. */
    readonly system: string;
};

/** The pure twin's props: every string resolved, the current choice and the report upward. */
export type ThemeToggleBaseProps = {
    /**
     * `pill` draws the bordered floating group the shell uses; `plain` keeps the same control
     * unframed for a surface that draws its own boundary.
     */
    readonly appearance?: "pill" | "plain";
    /** The currently chosen theme; drives each option's `aria-pressed`. */
    readonly theme: ThemeChoice;
    /** The resolved copy for the group label and each choice. */
    readonly labels: ThemeToggleLabels;
    /** Reports the choice the reader pressed. */
    readonly onSelect: (theme: ThemeChoice) => void;
};

/**
 * Three named theme choices rendered as a pressed-state button group. Pure: the connected index
 * resolves the copy and the stored choice, and this half draws them.
 */
export const ThemeToggleBase = (props: ThemeToggleBaseProps) => (
    <div
        role="group"
        aria-label={props.labels.group}
        className={props.appearance === "plain" ? THEME_TOGGLE_PLAIN_CLASS_NAME : THEME_TOGGLE_GROUP_CLASS_NAME}
    >
        {THEME_CHOICES.map((choice: ThemeChoice) => (
            <button
                key={choice}
                type="button"
                aria-pressed={props.theme === choice}
                className={THEME_TOGGLE_OPTION_CLASS_NAME}
                onClick={() => props.onSelect(choice)}
            >
                {props.labels[choice]}
            </button>
        ))}
    </div>
)
