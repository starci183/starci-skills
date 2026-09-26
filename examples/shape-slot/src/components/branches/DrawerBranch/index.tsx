"use client"

import type { ReactNode } from "react"
import { Drawer } from "@heroui/react"
import { drawerBranchBodyClassName, drawerBranchTriggerClassName } from "./classNames"

/** Props for DrawerBranch. */
export type DrawerBranchProps = {
    /** Owned by whoever mounts it, never by the branch. */
    readonly isOpen: boolean
    readonly title: string
    /** Every way out: close control, Escape, backdrop. */
    readonly onDismiss: () => void
    readonly children: ReactNode
}

/**
 * Branch: the vendor's edge-anchored drawer mechanics around typed children.
 * Owns intrinsic interaction only (focus trap, dismissal), never product state.
 */
export const DrawerBranch = (props: DrawerBranchProps) => (
    <Drawer
        isOpen={props.isOpen}
        onOpenChange={(open) => {
            if (!open) props.onDismiss()
        }}
    >
        <Drawer.Trigger className={drawerBranchTriggerClassName} aria-hidden isDisabled />
        <Drawer.Backdrop>
            <Drawer.Content placement="right">
                <Drawer.Dialog>
                    <Drawer.Header>
                        <Drawer.Heading>{props.title}</Drawer.Heading>
                    </Drawer.Header>
                    <Drawer.CloseTrigger />
                    <Drawer.Body className={drawerBranchBodyClassName}>{props.children}</Drawer.Body>
                </Drawer.Dialog>
            </Drawer.Content>
        </Drawer.Backdrop>
    </Drawer>
)
