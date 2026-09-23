"use client"

import { ButtonGroup as HeroButtonGroup } from "@heroui/react"
import { Children, cloneElement, isValidElement, type ReactNode } from "react"
import { Button } from "../../primitive/Button/index.js"
import { IconButton } from "../../primitive/IconButton/index.js"

export type ButtonGroupProps = {
    /** Names the group (`role="group"`) for assistive technology. */
    readonly label: string
    /** Grammar `Button`s (or `IconButton`s). They join visually and keep their own names. */
    readonly children: ReactNode
    readonly orientation?: "horizontal" | "vertical"
    /** Disables every Grammar Button and IconButton in the group. */
    readonly isDisabled?: boolean
    readonly width?: "content" | "fill"
}

/*
 * Grammar Button always states its own `isDisabled`, so the vendor group's disabled context (read
 * only when a button leaves the prop unset) never reaches it. A disabled group therefore hands the
 * state to its direct Grammar action children itself.
 */
const disableActions = (children: ReactNode) => Children.map(children, (child) => (
    isValidElement<{ readonly isDisabled?: boolean }>(child) && (child.type === Button || child.type === IconButton)
        ? cloneElement(child, { isDisabled: true })
        : child
))

/** Related actions joined into one visual unit. Each button stays its own tab stop. */
export const ButtonGroup = ({ label, children, orientation = "horizontal", isDisabled = false, width = "content" }: ButtonGroupProps) => (
    <HeroButtonGroup
        data-tier="composite"
        data-component="ButtonGroup"
        data-contract="FOCUS-2 TRUTH-2"
        data-grammar-orientation={orientation}
        data-grammar-disabled={isDisabled ? "true" : "false"}
        data-width={width}
        aria-label={label}
        orientation={orientation}
        isDisabled={isDisabled}
        fullWidth={width === "fill"}
        className="starci-core-button-group"
    >
        {isDisabled ? disableActions(children) : children}
    </HeroButtonGroup>
)
