import { Button as HeroButton, cn } from "@heroui/react"
import type { ComponentPropsWithoutRef, ReactNode } from "react"
import {
    subnavClassName,
    subnavIdentityClassName,
    subnavLeadingClassName,
    subnavTitleClassName,
    subnavToggleClassName,
} from "./classNames.js"

export type SubnavProps = Omit<ComponentPropsWithoutRef<"nav">, "children" | "title"> & {
    readonly label: string
    readonly title: ReactNode
    readonly leading?: ReactNode
    readonly menuIcon: ReactNode
    readonly openMenuLabel: string
    readonly closeMenuLabel: string
    readonly isMenuOpen: boolean
    readonly onMenuOpenChange?: (isOpen: boolean) => void
    readonly position?: "static" | "sticky"
    /** Compact projects a desktop sidebar/rail into this branch below 1120px. */
    readonly visibility?: "always" | "compact"
}

/** Compact course/workspace identity and the one control that opens its drawer. */
export const Subnav = ({
    label,
    title,
    leading,
    menuIcon,
    openMenuLabel,
    closeMenuLabel,
    isMenuOpen,
    onMenuOpenChange,
    position = "sticky",
    visibility = "compact",
    className,
    ...navProps
}: SubnavProps) => (
    <nav
        {...navProps}
        aria-label={label}
        className={cn(subnavClassName, className)}
        data-grammar-subnav="true"
        data-grammar-subnav-position={position}
        data-grammar-subnav-visibility={visibility}
        data-contract="GAP-3 BOUNDARY-1 PADDING-3"
    >
        <div className={subnavIdentityClassName} data-grammar-subnav-identity="true" data-contract="GAP-2">
            {leading === undefined ? null : <span className={subnavLeadingClassName} data-grammar-subnav-leading="true">{leading}</span>}
            <span className={subnavTitleClassName} data-grammar-subnav-title="true" data-contract="FLOW-4">{title}</span>
        </div>
        <HeroButton
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? closeMenuLabel : openMenuLabel}
            className={subnavToggleClassName ?? ""}
            data-grammar-subnav-toggle="true"
            isIconOnly
            onPress={() => onMenuOpenChange?.(!isMenuOpen)}
            type="button"
            variant="tertiary"
        >
            {menuIcon}
        </HeroButton>
    </nav>
)
