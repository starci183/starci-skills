import { Drawer as HeroDrawer } from "@heroui/react"
import { useId, type ReactNode } from "react"
import { overlayOpenProps, useOverlayContainer, type OverlayOpenState } from "../../overlayScope.js"
import { CloseButton } from "../../primitive/CloseButton/index.js"
import type { OverlayFooter } from "../Dialog/index.js"

/** Edge the sheet slides from. `bottom` is the mobile bottom sheet. */
export type DrawerPlacement = "left" | "right" | "top" | "bottom"

export type DrawerProps = OverlayOpenState & {
    /** Visible heading; the drawer dialog's accessible name. */
    readonly title: string
    readonly description?: ReactNode
    readonly children?: ReactNode
    readonly footer?: OverlayFooter
    /** A Common `Button`/`IconButton` (any React Aria pressable) that opens the drawer. */
    readonly trigger?: ReactNode
    readonly closeLabel?: string
    readonly placement?: DrawerPlacement
    /**
     * Draw the grab handle. Default: shown for `bottom` sheets only. The handle is decorative
     * (`aria-hidden`); dragging it past the threshold dismisses, the close button and Escape remain the
     * accessible ways out.
     */
    readonly showHandle?: boolean
    /** Close on an outside press (and allow drag-to-dismiss). Default `true`. */
    readonly isDismissable?: boolean
    readonly isKeyboardDismissDisabled?: boolean
}

/**
 * BRANCH - `Drawer`: a side sheet or mobile bottom sheet holding a secondary task.
 *
 * Same modal rules as `Dialog` (focus trap and return, Escape/outside dismiss, scroll lock, inert
 * page, scoped portal). Placement is echoed on `data-placement` so anatomy and families can shape the
 * sheet edge; the slide motion is removed under reduced motion.
 */
export const Drawer = ({
    title,
    description,
    children,
    footer,
    trigger,
    closeLabel,
    placement = "right",
    showHandle,
    isDismissable = true,
    isKeyboardDismissDisabled = false,
    ...openState
}: DrawerProps) => {
    const { anchor, container } = useOverlayContainer("Drawer")
    const descriptionId = useId()
    const hasHandle = showHandle ?? placement === "bottom"

    return (
        <HeroDrawer {...overlayOpenProps(openState)}>
            {trigger}
            {anchor}
            {container === null ? null : (
                <HeroDrawer.Backdrop
                    UNSTABLE_portalContainer={container}
                    isDismissable={isDismissable}
                    isKeyboardDismissDisabled={isKeyboardDismissDisabled}
                    data-grammar-overlay-backdrop="Drawer"
                    className="starci-core-overlay-backdrop starci-core-drawer-backdrop"
                >
                    <HeroDrawer.Content placement={placement} className="starci-core-drawer-content">
                        <HeroDrawer.Dialog
                            data-tier="branch"
                            data-component="Drawer"
                            data-placement={placement}
                            data-grammar-overlay-surface="drawer"
                            {...(description === undefined ? {} : { "aria-describedby": descriptionId })}
                            className="starci-core-drawer"
                        >
                            {({ close }) => (
                                <>
                                    {hasHandle ? <HeroDrawer.Handle data-grammar-drawer-handle="true" className="starci-core-drawer-handle" /> : null}
                                    <HeroDrawer.Header className="starci-core-overlay-header">
                                        <div className="starci-core-overlay-heading-group">
                                            <HeroDrawer.Heading className="starci-core-overlay-title">{title}</HeroDrawer.Heading>
                                            {description === undefined ? null : (
                                                <p id={descriptionId} className="starci-core-overlay-description">{description}</p>
                                            )}
                                        </div>
                                        {closeLabel === undefined ? null : <CloseButton label={closeLabel} onPress={close} />}
                                    </HeroDrawer.Header>
                                    {children === undefined ? null : (
                                        <HeroDrawer.Body className="starci-core-overlay-body">{children}</HeroDrawer.Body>
                                    )}
                                    {footer === undefined ? null : (
                                        <HeroDrawer.Footer className="starci-core-overlay-footer">
                                            {typeof footer === "function" ? footer(close) : footer}
                                        </HeroDrawer.Footer>
                                    )}
                                </>
                            )}
                        </HeroDrawer.Dialog>
                    </HeroDrawer.Content>
                </HeroDrawer.Backdrop>
            )}
        </HeroDrawer>
    )
}
