"use client"

import type { ComponentType } from "react"
import type { FeKitLinkProps } from "../../../i18n/navigation"
import {
    LOCALE_SWITCHER_GROUP_CLASS_NAME,
    LOCALE_SWITCHER_OPTION_CLASS_NAME,
    LOCALE_SWITCHER_PLAIN_CLASS_NAME,
} from "./classNames"

/** One locale the reader can switch to, fully resolved: label, destination and current marker. */
export type LocaleSwitcherOption<L extends string = string> = {
    /** The locale this link switches to. */
    readonly locale: L;
    /** The locale's resolved display name. */
    readonly label: string;
    /** The locale-free path the reader is already on; the link re-prefixes it. */
    readonly href: string;
    /** Whether this option is the locale the reader is currently in. */
    readonly current: boolean;
};

/** The pure twin's props: resolved options plus the locale-aware Link the app bound. */
export type LocaleSwitcherBaseProps<L extends string = string> = {
    /**
     * `pill` draws the bordered floating group the shell uses; `plain` keeps the same control
     * unframed for a surface that draws its own boundary.
     */
    readonly appearance?: "pill" | "plain";
    /** The group's accessible name. */
    readonly label: string;
    /** One resolved option per shipped locale. */
    readonly options: ReadonlyArray<LocaleSwitcherOption<L>>;
    /** The app's created-navigation Link, so each option stays a locale-aware hop. */
    readonly Link: ComponentType<FeKitLinkProps<L>>;
};

/**
 * One locale-aware link per shipped language, each pointing at the page the reader is already on.
 * Pure: the factory-bound index resolves locale, path and copy; this half draws the group.
 */
export const LocaleSwitcherBase = <L extends string>(props: LocaleSwitcherBaseProps<L>) => {
    const Link = props.Link
    return (
        <div
            role="group"
            aria-label={props.label}
            className={
                props.appearance === "plain" ? LOCALE_SWITCHER_PLAIN_CLASS_NAME : LOCALE_SWITCHER_GROUP_CLASS_NAME
            }
        >
            {props.options.map((option: LocaleSwitcherOption<L>) => (
                <Link
                    key={option.locale}
                    href={option.href}
                    locale={option.locale}
                    aria-current={option.current ? "true" : undefined}
                    className={LOCALE_SWITCHER_OPTION_CLASS_NAME}
                >
                    {option.label}
                </Link>
            ))}
        </div>
    )
}
