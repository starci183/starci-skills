"use client"

import { Avatar as HeroAvatar } from "@heroui/react"
import type { ReactNode } from "react"
import { navigationClassName } from "../../navigationClassNames.js"
import { Skeleton } from "../Skeleton/index.js"

export type AvatarSize = "sm" | "md" | "lg"

export type AvatarProps = {
    /** The person or entity the avatar stands for; it is the accessible name. */
    readonly name: string
    readonly src?: string
    /** Shown while the image loads or when it fails. Defaults to initials derived from `name`. */
    readonly fallback?: ReactNode
    readonly size?: AvatarSize
    /** A decorative avatar sits next to a visible name and is hidden from assistive technology. */
    readonly isDecorative?: boolean
    /** Selected/current identity, e.g. the active account in a switcher. */
    readonly isCurrent?: boolean
    readonly className?: string
    /**
     * Initial unresolved identity (knowledge STATE-8): a Skeleton circle at the avatar's `size`, `aria-hidden` (no name, no image, no
     * initials). The owning list or card carries `aria-busy`.
     */
    readonly isSkeleton?: boolean
}

/** Up to two initials from a display name; letters only come from the name the app supplied. */
export const avatarInitials = (name: string): string => name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toLocaleUpperCase()

/** Shared parts so AvatarGroup can hand HeroUI its own Avatar element directly. */
export const avatarParts = (name: string, src: string | undefined, fallback: ReactNode | undefined) => <>
    {src === undefined ? null : <HeroAvatar.Image alt="" src={src} />}
    <HeroAvatar.Fallback aria-hidden="true" data-grammar-avatar-fallback="true">{fallback ?? avatarInitials(name)}</HeroAvatar.Fallback>
</>

export const avatarA11yProps = (name: string, isDecorative: boolean) => isDecorative
    ? { "aria-hidden": true as const }
    : { role: "img" as const, "aria-label": name }

/**
 * A person or entity mark with image, initials fallback and an explicit accessible name.
 * Contract: A11Y-2 (named once or aria-hidden when decorative); initials remain while loading/failed.
 */
export const Avatar = ({ name, src, fallback, size = "md", isDecorative = false, isCurrent = false, className, isSkeleton = false }: AvatarProps) => isSkeleton ? (
    <span
        aria-hidden="true"
        className={navigationClassName("starci-core-avatar starci-core-avatar-skeleton", className)}
        data-component="Avatar"
        data-contract="STATE-8"
        data-tier="atom"
        data-grammar-avatar-size={size}
        data-grammar-current="false"
        data-grammar-skeleton="true"
    >
        <Skeleton shape="circle" size={size} />
    </span>
) : (
    <HeroAvatar
        {...avatarA11yProps(name, isDecorative)}
        className={navigationClassName("starci-core-avatar", className)}
        data-component="Avatar"
        data-contract="A11Y-2"
        data-tier="atom"
        data-grammar-avatar-size={size}
        data-grammar-current={isCurrent ? "true" : "false"}
        size={size}
    >
        {avatarParts(name, src, fallback)}
    </HeroAvatar>
)
