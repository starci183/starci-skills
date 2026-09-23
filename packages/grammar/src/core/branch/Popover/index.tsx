import { Popover as HeroPopover } from "@heroui/react"
import type { ReactNode } from "react"
import { overlayOpenProps, useOverlayContainer, type OverlayOpenState } from "../../overlayScope.js"

/** Side of the trigger the panel opens on; it flips when the viewport has no room. */
export type PopoverPlacement = "top" | "bottom" | "start" | "end"

type PopoverBase = OverlayOpenState & {
    /** A Common `Button`/`IconButton` (any React Aria pressable) that toggles the panel. */
    readonly trigger: ReactNode
    readonly children: ReactNode
    readonly placement?: PopoverPlacement
    /** Draw the pointer arrow toward the trigger. Default `false`. */
    readonly showArrow?: boolean
}

/** A popover is a non-modal dialog, so it needs a name: a visible title or an accessible label. */
type TitledPopover = { readonly title: string; readonly label?: never }
type LabelledPopover = { readonly label: string; readonly title?: never }

export type PopoverProps = PopoverBase & (TitledPopover | LabelledPopover)

/**
 * BRANCH - `Popover`: rich, interactive content anchored to a trigger.
 *
 * Unlike `Tooltip` (a description), a popover holds focusable content. React Aria moves focus into
 * the panel, contains Tab while open, dismisses on Escape or an outside press, and returns focus to
 * the trigger. The panel portals into the nearest Grammar root so the family scope still applies.
 */
export const Popover = ({
    trigger,
    children,
    placement = "bottom",
    showArrow = false,
    title,
    label,
    ...openState
}: PopoverProps) => {
    const { anchor, container } = useOverlayContainer("Popover")

    return (
        <HeroPopover {...overlayOpenProps(openState)}>
            {trigger}
            {anchor}
            {container === null ? null : (
                <HeroPopover.Content
                    UNSTABLE_portalContainer={container}
                    placement={placement}
                    offset={8}
                    data-grammar-overlay-surface="popover"
                    className="starci-core-popover"
                >
                    {showArrow ? (
                        <HeroPopover.Arrow className="starci-core-popover-arrow" data-grammar-popover-arrow="true" />
                    ) : null}
                    <HeroPopover.Dialog
                        data-tier="branch"
                        data-component="Popover"
                        {...(label === undefined ? {} : { "aria-label": label })}
                        className="starci-core-popover-dialog"
                    >
                        {title === undefined ? null : (
                            <HeroPopover.Heading className="starci-core-overlay-title">{title}</HeroPopover.Heading>
                        )}
                        <div className="starci-core-popover-body">{children}</div>
                    </HeroPopover.Dialog>
                </HeroPopover.Content>
            )}
        </HeroPopover>
    )
}
