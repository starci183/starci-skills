import { AlertDialog as HeroAlertDialog } from "@heroui/react"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import type { PresentationState } from "../../../common/state.js"
import { overlayOpenProps, useOverlayContainer, vendorStatusFor, type OverlayOpenState } from "../../overlayScope.js"
import { Button } from "../../primitive/Button/index.js"

export type AlertDialogProps = OverlayOpenState & {
    /** The question being confirmed; the dialog's accessible name. */
    readonly title: string
    /** The consequence, wired as `aria-describedby`. */
    readonly description?: ReactNode
    readonly children?: ReactNode
    /**
     * Meaning of the decision. `negative` marks a destructive confirm (danger-toned action);
     * anything else confirms with the family decision accent. Default `negative`.
     */
    readonly tone?: PresentationState
    readonly confirmLabel: string
    readonly cancelLabel: string
    /**
     * Runs on confirm. Returning a promise keeps the dialog open and the confirm action pending
     * until it settles; it closes on success and stays open on rejection so the person can retry.
     */
    readonly onConfirm: () => void | Promise<unknown>
    readonly onCancel?: () => void
    /** App-owned pending state for a confirm whose work is tracked elsewhere. */
    readonly isConfirmPending?: boolean
    /** A Common `Button` (any React Aria pressable) that opens the confirmation. */
    readonly trigger?: ReactNode
    /** Escape cancels by default; disable only when cancelling would itself be unsafe. */
    readonly isKeyboardDismissDisabled?: boolean
}

/** Holds the safe (cancel) action and takes initial focus when the dialog opens (WAI-ARIA APG). */
const SafeAction = ({ children }: { readonly children: ReactNode }) => {
    const ref = useRef<HTMLSpanElement>(null)
    useEffect(() => {
        ref.current?.querySelector<HTMLElement>("button, a[href]")?.focus()
    }, [])
    return <span ref={ref} data-grammar-overlay-action="cancel">{children}</span>
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => (
    typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function"
)

/**
 * BRANCH - `AlertDialog`: an interrupting confirmation (`role="alertdialog"`).
 *
 * Dismiss rules differ from `Dialog` on purpose: an outside press never dismisses (the decision must
 * be explicit), Escape cancels, and the cancel action is first in focus order so initial focus lands
 * on the safe choice. Focus trap/return, scroll lock and the scoped portal are the `Dialog` rules.
 */
export const AlertDialog = ({
    title,
    description,
    children,
    tone = "negative",
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    isConfirmPending = false,
    trigger,
    isKeyboardDismissDisabled = false,
    ...openState
}: AlertDialogProps) => {
    const { anchor, container } = useOverlayContainer("AlertDialog")
    const descriptionId = useId()
    const [isRunning, setIsRunning] = useState(false)
    const confirmedRef = useRef(false)
    const pending = isConfirmPending || isRunning
    const onOpenChange = (isOpen: boolean) => {
        if (isOpen) confirmedRef.current = false
        else if (confirmedRef.current) confirmedRef.current = false
        else onCancel?.()
        openState.onOpenChange?.(isOpen)
    }

    return (
        <HeroAlertDialog {...overlayOpenProps({ ...openState, onOpenChange })}>
            {trigger}
            {anchor}
            {container === null ? null : (
                <HeroAlertDialog.Backdrop
                    UNSTABLE_portalContainer={container}
                    isDismissable={false}
                    isKeyboardDismissDisabled={isKeyboardDismissDisabled || pending}
                    data-grammar-overlay-backdrop="AlertDialog"
                    className="starci-core-overlay-backdrop"
                >
                    <HeroAlertDialog.Container placement="center" size="sm" data-size="sm" className="starci-core-dialog-container">
                        <HeroAlertDialog.Dialog
                            data-tier="branch"
                            data-component="AlertDialog"
                            data-grammar-tone={tone}
                            data-grammar-overlay-surface="dialog"
                            {...(description === undefined ? {} : { "aria-describedby": descriptionId })}
                            className="starci-core-dialog starci-core-alert-dialog"
                        >
                            {({ close }) => {
                                const confirm = () => {
                                    const result = onConfirm()
                                    if (!isPromiseLike(result)) {
                                        if (!isConfirmPending) {
                                            confirmedRef.current = true
                                            close()
                                        }
                                        return
                                    }
                                    setIsRunning(true)
                                    result.then(
                                        () => {
                                            setIsRunning(false)
                                            confirmedRef.current = true
                                            close()
                                        },
                                        () => { setIsRunning(false) },
                                    )
                                }
                                return (
                                    <>
                                        <HeroAlertDialog.Header className="starci-core-overlay-header">
                                            <HeroAlertDialog.Icon status={vendorStatusFor(tone)} className="starci-core-alert-dialog-icon" />
                                            <div className="starci-core-overlay-heading-group">
                                                <HeroAlertDialog.Heading className="starci-core-overlay-title">{title}</HeroAlertDialog.Heading>
                                                {description === undefined ? null : (
                                                    <p id={descriptionId} className="starci-core-overlay-description">{description}</p>
                                                )}
                                            </div>
                                        </HeroAlertDialog.Header>
                                        {children === undefined ? null : (
                                            <HeroAlertDialog.Body className="starci-core-overlay-body">{children}</HeroAlertDialog.Body>
                                        )}
                                        <HeroAlertDialog.Footer className="starci-core-overlay-footer">
                                            <SafeAction>
                                                <Button variant="secondary" isDisabled={pending} onPress={close}>{cancelLabel}</Button>
                                            </SafeAction>
                                            <span data-grammar-overlay-action="confirm" data-grammar-tone={tone}>
                                                <Button variant="primary" isPending={pending} onPress={confirm}>{confirmLabel}</Button>
                                            </span>
                                        </HeroAlertDialog.Footer>
                                    </>
                                )
                            }}
                        </HeroAlertDialog.Dialog>
                    </HeroAlertDialog.Container>
                </HeroAlertDialog.Backdrop>
            )}
        </HeroAlertDialog>
    )
}
