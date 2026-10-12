import { Button as HeroButton, cn, skeletonVariants } from "@heroui/react"
import { Icon, type IconSource } from "../Icon/index.js"

/**
 * HeroUI Button variants an icon-only action wears: `tertiary` (default) is the filled round plate;
 * `ghost` is the quiet bare glyph with no fill at rest (HeroUI's ghost: a fill only on hover/press) -
 * for an overflow "..." menu or a secondary glyph action beside a card title. `primary` is the accent-filled plate for the
 * one glyph action that must stand out (a floating assistant or compose button); one per view, like a primary Button.
 * `danger-soft` is the danger tone's soft tint plate (`--danger-soft` ground, `--danger-soft-foreground` glyph, one step
 * stronger on hover): use it for a reversible or row-level destructive action, such as a trash glyph that deletes a row.
 * A confirmed destructive action inside an AlertDialog uses the solid `danger` Button instead.
 */
export type IconButtonVariant = "tertiary" | "ghost" | "primary" | "danger-soft"

export type IconButtonProps = {
    readonly source: IconSource
    /** Required accessible name for the glyph-only action. */
    readonly label: string
    readonly variant?: IconButtonVariant
    /** `md` (default, 2.25rem) or `lg` (3.5rem), the size of a floating action. */
    readonly size?: "md" | "lg"
    /** Lifts the button with the overlay elevation, for an action floating over content (it owns no position). */
    readonly isFloating?: boolean
    readonly isActive?: boolean
    readonly isDisabled?: boolean
    readonly isSkeleton?: boolean
    readonly onPress?: () => void
    /** Disclosure: the id of the region this button shows and hides (`aria-controls`). */
    readonly "aria-controls"?: string
    /** Disclosure: whether that region is open now (`aria-expanded`). */
    readonly "aria-expanded"?: boolean
    /**
     * A count pinned to the glyph's top end corner (unread notifications, waiting items). `0`, empty or absent draws nothing;
     * a number above `badgeMax` shows as `badgeMax+`. The plate is decorative: `badgeLabel` carries the count to assistive tech.
     */
    readonly badge?: number | string
    /** Appended to the accessible name when a badge shows, e.g. "3 unread". Required for a badge to be announced. */
    readonly badgeLabel?: string
    /** Largest number shown before it collapses to `n+`. Default 99. */
    readonly badgeMax?: number
}

/** What the badge plate prints: nothing for 0 / empty, the capped number, or the given text. */
export const iconButtonBadgeText = (badge: number | string | undefined, max = 99): string | null => {
    if (badge === undefined || badge === "" || badge === 0) return null
    if (typeof badge === "number") return badge > max ? `${max}+` : String(badge)
    return badge
}

/**
 * The pill corner is SHIPPED by `.starci-core-icon-button` in `src/common/styles.css`, for the
 * resolved action and its resting shimmer alike; only the shimmer itself comes from the vendor.
 */
const SKELETON_CLASS_NAME = skeletonVariants({ animationType: "shimmer" }).base()

/** Circular glyph-only action with a mandatory accessible name (A11Y-2). */
export const IconButton = ({
    source,
    label,
    variant = "tertiary",
    size = "md",
    isFloating = false,
    isActive = false,
    isDisabled = false,
    isSkeleton = false,
    onPress,
    "aria-controls": controls,
    "aria-expanded": expanded,
    badge,
    badgeLabel,
    badgeMax = 99,
}: IconButtonProps) => {
    const badgeText = isSkeleton ? null : iconButtonBadgeText(badge, badgeMax)
    return (
    <HeroButton
        data-tier="atom"
        data-component="IconButton"
        data-contract="A11Y-2"
        data-active={isActive ? "true" : "false"}
        data-variant={variant}
        data-size={size}
        data-floating={isFloating ? "true" : "false"}
        data-loading={isSkeleton ? "true" : "false"}
        type="button"
        variant={variant}
        className={cn("starci-core-icon-button", isSkeleton ? SKELETON_CLASS_NAME : undefined) ?? "starci-core-icon-button"}
        isIconOnly
        isDisabled={isDisabled || isSkeleton}
        aria-label={badgeText !== null && badgeLabel !== undefined ? `${label}, ${badgeLabel}` : label}
        data-grammar-icon-button-badge={badgeText === null ? "none" : "present"}
        {...(controls === undefined ? {} : { "aria-controls": controls })}
        {...(expanded === undefined ? {} : { "aria-expanded": expanded })}
        {...(isDisabled || isSkeleton || onPress === undefined ? {} : { onPress })}
    >
        {isSkeleton ? null : <Icon source={source} usage="leading" />}
        {badgeText === null ? null : <span aria-hidden className="starci-core-icon-button-badge" data-contract="TONE-2">{badgeText}</span>}
    </HeroButton>
    )
}
