import { Modal as HeroModal } from "@heroui/react"
import { useId, type ReactNode } from "react"
import { overlayOpenProps, useOverlayContainer, type OverlayOpenState } from "../../overlayScope.js"
import { CloseButton } from "../../primitive/CloseButton/index.js"

export type DialogSize = "sm" | "md" | "lg" | "full"

/** Footer content, or a function receiving `close` for actions that should dismiss the dialog. */
export type OverlayFooter = ReactNode | ((close: () => void) => ReactNode)

export type DialogProps = OverlayOpenState & {
    /** Visible heading; it is the dialog's accessible name (`aria-labelledby`). */
    readonly title: string
    /** Supporting sentence under the heading, wired as `aria-describedby`. */
    readonly description?: ReactNode
    readonly children?: ReactNode
    readonly footer?: OverlayFooter
    /**
     * The control that opens the dialog: a Common `Button`/`IconButton` (any React Aria pressable).
     * Omit it and drive `isOpen` for a dialog opened by app state.
     */
    readonly trigger?: ReactNode
    /** Name for the header close button. Omit only when the footer offers its own way out. */
    readonly closeLabel?: string
    readonly size?: DialogSize
    /** Close when the person presses outside the dialog. Default `true`. */
    readonly isDismissable?: boolean
    /** Disable Escape. Default `false`; keep Escape unless leaving would lose unsaved work. */
    readonly isKeyboardDismissDisabled?: boolean
}

/**
 * BRANCH - `Dialog` (modal): a focused task above the page.
 *
 * React Aria owns the behaviour: focus moves into the dialog and is trapped there, Escape and an
 * outside press dismiss it (each can be turned off), page scroll is locked, everything outside is
 * hidden from assistive tech, and focus returns to the trigger on close. The portal lands inside the
 * nearest `.grammar-common-root` (see `useOverlayContainer`), so the family scope still applies.
 */
export const Dialog = ({
    title,
    description,
    children,
    footer,
    trigger,
    closeLabel,
    size = "md",
    isDismissable = true,
    isKeyboardDismissDisabled = false,
    ...openState
}: DialogProps) => {
    const { anchor, container } = useOverlayContainer("Dialog")
    const descriptionId = useId()

    return (
        <HeroModal {...overlayOpenProps(openState)}>
            {trigger}
            {anchor}
            {container === null ? null : (
                <HeroModal.Backdrop
                    UNSTABLE_portalContainer={container}
                    isDismissable={isDismissable}
                    isKeyboardDismissDisabled={isKeyboardDismissDisabled}
                    data-grammar-overlay-backdrop="Dialog"
                    className="starci-core-overlay-backdrop"
                >
                    <HeroModal.Container placement="center" size={size} scroll="inside" data-size={size} className="starci-core-dialog-container">
                        <HeroModal.Dialog
                            data-tier="branch"
                            data-component="Dialog"
                            data-size={size}
                            data-grammar-overlay-surface="dialog"
                            {...(description === undefined ? {} : { "aria-describedby": descriptionId })}
                            className="starci-core-dialog"
                        >
                            {({ close }) => (
                                <>
                                    <HeroModal.Header className="starci-core-overlay-header">
                                        <div className="starci-core-overlay-heading-group">
                                            <HeroModal.Heading className="starci-core-overlay-title">{title}</HeroModal.Heading>
                                            {description === undefined ? null : (
                                                <p id={descriptionId} className="starci-core-overlay-description">{description}</p>
                                            )}
                                        </div>
                                        {closeLabel === undefined ? null : <CloseButton label={closeLabel} onPress={close} />}
                                    </HeroModal.Header>
                                    {children === undefined ? null : (
                                        <HeroModal.Body className="starci-core-overlay-body">{children}</HeroModal.Body>
                                    )}
                                    {footer === undefined ? null : (
                                        <HeroModal.Footer className="starci-core-overlay-footer">
                                            {typeof footer === "function" ? footer(close) : footer}
                                        </HeroModal.Footer>
                                    )}
                                </>
                            )}
                        </HeroModal.Dialog>
                    </HeroModal.Container>
                </HeroModal.Backdrop>
            )}
        </HeroModal>
    )
}
