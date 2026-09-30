import { Button as HeroButton, cn, skeletonVariants } from "@heroui/react"
import { Icon, type IconSource } from "../Icon/index.js"

/**
 * HeroUI Button variants an icon-only action wears: `tertiary` (default) is the filled round plate;
 * `ghost` is the quiet bare glyph with no fill at rest (HeroUI's ghost: a fill only on hover/press) -
 * for an overflow "..." menu or a secondary glyph action beside a card title.
 */
export type IconButtonVariant = "tertiary" | "ghost"

export type IconButtonProps = {
    readonly source: IconSource
    /** Required accessible name for the glyph-only action. */
    readonly label: string
    readonly variant?: IconButtonVariant
    readonly isActive?: boolean
    readonly isDisabled?: boolean
    readonly isSkeleton?: boolean
    readonly onPress?: () => void
    /** Disclosure: the id of the region this button shows and hides (`aria-controls`). */
    readonly "aria-controls"?: string
    /** Disclosure: whether that region is open now (`aria-expanded`). */
    readonly "aria-expanded"?: boolean
}

/**
 * The pill corner is SHIPPED by `.starci-core-icon-button` in `src/common/styles.css`, for the
 * resolved action and its resting shimmer alike; only the shimmer itself comes from the vendor.
 */
const SKELETON_CLASS_NAME = skeletonVariants({ animationType: "shimmer" }).base()

/** Circular glyph-only action with a mandatory accessible name (A11Y-2, ICON-5). */
export const IconButton = ({
    source,
    label,
    variant = "tertiary",
    isActive = false,
    isDisabled = false,
    isSkeleton = false,
    onPress,
    "aria-controls": controls,
    "aria-expanded": expanded,
}: IconButtonProps) => (
    <HeroButton
        data-tier="atom"
        data-component="IconButton"
        data-contract="A11Y-2 ICON-5"
        data-active={isActive ? "true" : "false"}
        data-variant={variant}
        data-loading={isSkeleton ? "true" : "false"}
        type="button"
        variant={variant}
        className={cn("starci-core-icon-button", isSkeleton ? SKELETON_CLASS_NAME : undefined) ?? "starci-core-icon-button"}
        isIconOnly
        isDisabled={isDisabled || isSkeleton}
        aria-label={label}
        {...(controls === undefined ? {} : { "aria-controls": controls })}
        {...(expanded === undefined ? {} : { "aria-expanded": expanded })}
        {...(isDisabled || isSkeleton || onPress === undefined ? {} : { onPress })}
    >
        {isSkeleton ? null : <Icon source={source} usage="leading" />}
    </HeroButton>
)
