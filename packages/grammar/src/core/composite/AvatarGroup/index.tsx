"use client"

import { Avatar as HeroAvatar, AvatarGroup as HeroAvatarGroup } from "@heroui/react"
import { avatarA11yProps, avatarParts, type AvatarSize } from "../../primitive/Avatar/index.js"
import { navigationClassName } from "../../navigationClassNames.js"

export type AvatarGroupItem = {
    readonly id: string
    readonly name: string
    readonly src?: string
}

export type AvatarGroupProps = {
    /** Names the group, e.g. who is in a space. */
    readonly label: string
    readonly items: ReadonlyArray<AvatarGroupItem>
    /** Visible avatars before the rest collapse into an overflow count. */
    readonly max?: number
    readonly size?: AvatarSize
    /** App-owned accessible text for the overflow count, e.g. "3 more people". */
    readonly overflowLabel: (hiddenCount: number) => string
    readonly className?: string
}

/**
 * A stacked set of avatars with one accessible overflow count.
 * Contract: each avatar ICON-6 MEDIA-5 (named once, initials fallback), count ICON-6 (named, digits silent).
 */
export const AvatarGroup = ({ label, items, max = 4, size = "md", overflowLabel, className }: AvatarGroupProps) => {
    const visible = items.slice(0, Math.max(0, max))
    const hidden = items.length - visible.length
    return (
        <HeroAvatarGroup
            aria-label={label}
            className={navigationClassName("starci-core-avatar-group", className)}
            data-component="AvatarGroup"
            data-tier="composite"
            data-grammar-avatar-overflow={hidden > 0 ? "true" : "false"}
            overlap="ring"
            role="group"
            size={size}
        >
            {visible.map((item) => (
                <HeroAvatar
                    key={item.id}
                    {...avatarA11yProps(item.name, false)}
                    className="starci-core-avatar"
                    data-component="Avatar"
                    data-contract="ICON-6 MEDIA-5"
                    data-grammar-avatar-size={size}
                >
                    {avatarParts(item.name, item.src, undefined)}
                </HeroAvatar>
            ))}
            {hidden > 0 ? (
                <HeroAvatarGroup.Count aria-label={overflowLabel(hidden)} data-contract="ICON-6" data-grammar-avatar-count="true" role="img">
                    <span aria-hidden="true">{`+${hidden}`}</span>
                </HeroAvatarGroup.Count>
            ) : null}
        </HeroAvatarGroup>
    )
}
