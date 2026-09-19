"use client"

import { Spinner, skeletonVariants } from "@heroui/react"
import { useRef, type ReactNode } from "react"
import { getActionClassName, type ActionAppearance, type ActionTextSize } from "../actionStyles.js"

type ActionBase = {
    readonly children: ReactNode
    readonly startContent?: ReactNode
    readonly endContent?: ReactNode
    readonly appearance?: ActionAppearance
    readonly size?: ActionTextSize
    readonly isCurrent?: boolean
    readonly isDisabled?: boolean
    readonly isPending?: boolean
    readonly isSkeleton?: boolean
}

/**
 * A real browser destination. It renders an anchor, so middle-click, copy-link, and the `link` role
 * come from the platform. While pending or disabled the href is withheld and the anchor is marked
 * unavailable; it is never turned into a button to express that state.
 */
type DestinationAction = {
    readonly href: string
    readonly target?: "_blank" | "_self"
    readonly rel?: string
    readonly download?: boolean | string
    /** Runs alongside navigation. It cannot cancel the destination. */
    readonly onFollow?: () => void
    readonly onPress?: never
}

/** A same-document command. It renders a button and owns pending against duplicate presses. */
type CommandAction = {
    readonly onPress?: () => void
    readonly href?: never
    readonly target?: never
    readonly rel?: never
    readonly download?: never
    readonly onFollow?: never
}

/**
 * The text-shaped action. The element is decided by which of `href` or `onPress` is present, and
 * the type forbids both, so a destination cannot be written as a button by choosing the wrong leaf.
 */
export type TextActionProps = ActionBase & (DestinationAction | CommandAction)

const SKELETON_CLASS_NAME = skeletonVariants({ animationType: "shimmer" }).base({
    className: "starci-core-text-action-resting",
})

const FONT_RULE_BY_SIZE: Record<ActionTextSize, string> = {
    xs: "FONT-1",
    sm: "FONT-2",
    md: "FONT-3",
}

/**
 * Padding rule ids per appearance, from the shipped `.starci-core-text-action`
 * appearance rules. Each side is matched against padding.md's `## Scale` via the
 * axis-variant rule: choice is PADDING-2 inline / PADDING-1 block; route and
 * section are PADDING-3 inline / PADDING-2 block; tab is PADDING-3 block only.
 * `inline`, `muted`, `disclosure` and `plain` draw no inset.
 */
const PADDING_RULES_BY_APPEARANCE: Partial<Record<ActionAppearance, ReadonlyArray<string>>> = {
    choice: ["PADDING-2", "PADDING-1"],
    route: ["PADDING-3", "PADDING-2"],
    section: ["PADDING-3", "PADDING-2"],
    tab: ["PADDING-3"],
}

/**
 * Tone rule ids per appearance, from the shipped `.starci-core-text-action`
 * appearance rules, matched against tone.md `## Scale`. `choice`, `route` and
 * `section` swap to the accent-soft foreground (TONE-3) only at
 * `data-current="true"`, mirrored here from the already-known `isCurrent` prop.
 * `tab`'s current-state colour is the accent itself, which tone.md does not
 * publish, so that state stays unclaimed.
 */
const getToneRule = (appearance: ActionAppearance, isCurrent: boolean): string | undefined => {
    switch (appearance) {
    case "inline":
    case "plain":
        return "TONE-1"
    case "muted":
        return "TONE-2"
    case "choice":
    case "section":
        return isCurrent ? "TONE-3" : "TONE-1"
    case "route":
        return isCurrent ? "TONE-3" : "TONE-2"
    case "tab":
        // Current state renders the accent itself, which tone.md does not publish.
        return isCurrent ? undefined : "TONE-2"
    case "disclosure":
        return "TONE-3"
    }
}

/**
 * Rule ids this element can claim from actionStyles.ts's shared recipe.
 * The always-present 0.5rem gap matches gap.md's scale directly (GAP-2), and the
 * content width matches measure.md's MEASURE-3 (Content width) catalog entry.
 * Size selects the FONT-1/2/3 row. Appearance (with `isCurrent`) selects the tone
 * row and any padding rows. Medium/semibold weight, the pill and section corners,
 * and the `tab` underline/border carry no rule id in their topic files and stay
 * unclaimed.
 */
/**
 * `choice`, `route` and `section` swap to the accent-soft surface only at
 * `data-current="true"`, pairing with the same accent-soft foreground as TONE-3.
 * That pair matches surface.md's SURFACE-4 catalog entry exactly.
 */
const CURRENT_SURFACE_APPEARANCES: ReadonlySet<ActionAppearance> = new Set(["choice", "route", "section"])

const getActionContract = (appearance: ActionAppearance, size: ActionTextSize, isCurrent: boolean) => {
    const toneRule = getToneRule(appearance, isCurrent)
    const ids = ["GAP-2", "MEASURE-3", FONT_RULE_BY_SIZE[size], ...(toneRule === undefined ? [] : [toneRule])]
    if (isCurrent && CURRENT_SURFACE_APPEARANCES.has(appearance)) ids.push("SURFACE-4")
    const paddingRules = PADDING_RULES_BY_APPEARANCE[appearance]
    if (paddingRules !== undefined) ids.push(...paddingRules)
    return ids.join(" ")
}

/** Text-shaped action: an anchor for a destination, a button for a command. */
export const TextAction = (props: TextActionProps) => {
    const {
        children,
        startContent,
        endContent,
        appearance = "inline",
        size = "sm",
        isCurrent = false,
        isDisabled = false,
        isPending = false,
        isSkeleton = false,
    } = props
    const pressLockRef = useRef(false)
    const unavailable = isDisabled || isPending

    if (isSkeleton) {
        return <span data-tier="atom" data-component="TextAction" data-loading="true" aria-hidden className={SKELETON_CLASS_NAME}>&nbsp;</span>
    }

    const shared = {
        "data-tier": "atom",
        "data-component": "TextAction",
        "data-appearance": appearance,
        "data-current": isCurrent ? "true" : "false",
        "data-action-pending": isPending ? "true" : "false",
        "aria-busy": isPending || undefined,
        "data-size": size,
        "data-contract": getActionContract(appearance, size, isCurrent),
        className: getActionClassName(),
    } as const
    const content = (
        <>
            {isPending ? <Spinner size="sm" color="current" aria-hidden="true" /> : startContent}
            <span>{children}</span>
            {isPending ? null : endContent}
        </>
    )

    if (props.href !== undefined) {
        const { href, target, rel, download, onFollow } = props
        return (
            <a
                {...shared}
                data-element="a"
                role={unavailable ? "link" : undefined}
                aria-disabled={unavailable || undefined}
                aria-current={isCurrent ? appearance === "route" ? "page" : "true" : undefined}
                {...(unavailable ? {} : { href })}
                {...(target === undefined ? {} : { target })}
                {...(rel === undefined ? target === "_blank" ? { rel: "noopener noreferrer" } : {} : { rel })}
                {...(download === undefined ? {} : { download })}
                {...(onFollow === undefined || unavailable ? {} : { onClick: onFollow })}
            >
                {content}
            </a>
        )
    }

    const { onPress } = props
    const press = () => {
        if (unavailable || pressLockRef.current || onPress === undefined) return
        pressLockRef.current = true
        onPress()
        globalThis.setTimeout(() => { pressLockRef.current = false }, 300)
    }

    return (
        <button
            {...shared}
            data-element="button"
            type="button"
            disabled={unavailable}
            aria-current={isCurrent ? appearance === "route" ? "page" : "true" : undefined}
            onClick={press}
        >
            {content}
        </button>
    )
}

export type { ActionAppearance as TextActionAppearance, ActionTextSize as TextActionSize }
