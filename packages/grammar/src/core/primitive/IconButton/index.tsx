import { Button as HeroButton, cn, skeletonVariants } from "@heroui/react"
import { Icon, type IconSource } from "../Icon/index.js"

export type IconButtonProps = {
    readonly source: IconSource
    /** Required accessible name for the glyph-only action. */
    readonly label: string
    readonly isActive?: boolean
    readonly isDisabled?: boolean
    readonly isSkeleton?: boolean
    readonly onPress?: () => void
}

/**
 * The pill corner is SHIPPED by `.starci-core-icon-button` in `src/common/styles.css`, for the
 * resolved action and its resting shimmer alike; only the shimmer itself comes from the vendor.
 */
const SKELETON_CLASS_NAME = skeletonVariants({ animationType: "shimmer" }).base()

/** Circular glyph-only action with a mandatory accessible name. */
export const IconButton = ({
    source,
    label,
    isActive = false,
    isDisabled = false,
    isSkeleton = false,
    onPress,
}: IconButtonProps) => (
    <HeroButton
        data-tier="atom"
        data-component="IconButton"
        data-active={isActive ? "true" : "false"}
        data-loading={isSkeleton ? "true" : "false"}
        type="button"
        variant="tertiary"
        className={cn("starci-core-icon-button", isSkeleton ? SKELETON_CLASS_NAME : undefined) ?? "starci-core-icon-button"}
        isIconOnly
        isDisabled={isDisabled || isSkeleton}
        aria-label={label}
        {...(isDisabled || isSkeleton || onPress === undefined ? {} : { onPress })}
    >
        {isSkeleton ? null : <Icon source={source} usage="leading" />}
    </HeroButton>
)
