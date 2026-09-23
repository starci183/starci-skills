import { CloseButton as HeroCloseButton } from "@heroui/react"

export type CloseButtonSize = "sm" | "md"

export type CloseButtonProps = {
    /** Required accessible name for the glyph-only dismiss action (the app resolves its words). */
    readonly label: string
    readonly onPress?: () => void
    readonly isDisabled?: boolean
    readonly size?: CloseButtonSize
}

/**
 * ATOM - `CloseButton`: the glyph-only dismiss action used by dialogs, drawers, toasts and banners.
 *
 * It is the vendor close button (a real `<button type="button">` with the platform close glyph) with
 * a mandatory name. Its pressable floor and focus ring are SHIPPED by `.starci-core-close-button` in
 * `src/common/components-overlays.css`.
 */
export const CloseButton = ({ label, onPress, isDisabled = false, size = "md" }: CloseButtonProps) => (
    <HeroCloseButton
        data-tier="atom"
        data-component="CloseButton"
        data-size={size}
        aria-label={label}
        data-contract="A11Y-2 ICON-5 FOCUS-1"
        isDisabled={isDisabled}
        className="starci-core-close-button"
        {...(isDisabled || onPress === undefined ? {} : { onPress })}
    />
)
