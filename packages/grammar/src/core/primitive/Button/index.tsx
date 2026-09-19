import { Button as HeroButton, Spinner as HeroSpinner, buttonVariants, skeletonVariants } from "@heroui/react"
import type { ReactNode } from "react"

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "outline" | "ghost"
export type ButtonSize = "sm" | "md" | "lg"
export type ButtonType = "button" | "submit" | "reset"
export type ButtonWidth = "content" | "fill"

type ButtonBase = {
    /** The visible action label. It remains present while the action is pending. */
    readonly children: ReactNode
    readonly variant?: ButtonVariant
    readonly size?: ButtonSize
    /** Decorative or explanatory content before the label. Product icon identity stays with the app. */
    readonly startContent?: ReactNode
    /** Directional or explanatory content after the label. */
    readonly endContent?: ReactNode
    readonly isDisabled?: boolean
    /** Initial unresolved-content geometry. It is distinct from action-owned pending. */
    readonly isSkeleton?: boolean
    /** Pending belongs to the action that started the work and blocks duplicate presses. */
    readonly isPending?: boolean
    /**
     * How the action takes its inline space: to its own content, or filling its parent.
     *
     * `fill` forwards the vendor's own full-width variant and adds the part the vendor does not
     * own - a label that WRAPS onto a second line instead of overflowing, with the control height
     * released to follow it - from `.starci-core-button[data-width="fill"]` in the packaged
     * stylesheet. An app never has to reach through the boundary with a descendant width utility.
     */
    readonly width?: ButtonWidth
}

/**
 * A real browser destination wearing the button appearance. It renders an anchor, so the platform
 * supplies middle-click, copy-link, and the `link` role. Pending or disabled withholds the href.
 */
type DestinationButton = {
    readonly href: string
    readonly target?: "_blank" | "_self"
    readonly rel?: string
    readonly download?: boolean | string
    /** Runs alongside navigation. It cannot cancel the destination. */
    readonly onFollow?: () => void
    readonly onPress?: never
    readonly type?: never
}

/** A same-document command. It renders the vendor button and may submit or reset a form. */
type CommandButton = {
    readonly onPress?: () => void
    readonly type?: ButtonType
    readonly href?: never
    readonly target?: never
    readonly rel?: never
    readonly download?: never
    readonly onFollow?: never
}

/**
 * The button-shaped action. The element is decided by which of `href` or `onPress` is present, and
 * the type forbids both, so a destination cannot be written as a button by choosing the wrong leaf.
 */
export type ButtonProps = ButtonBase & (DestinationButton | CommandButton)

const VARIANTS = {
    primary: "primary",
    secondary: "secondary",
    tertiary: "tertiary",
    outline: "outline",
    ghost: "ghost",
} as const

const SIZES = { sm: "sm", md: "md", lg: "lg" } as const
const SKELETON_CLASS_NAME = skeletonVariants({ animationType: "shimmer" }).base({
    className: "select-none text-transparent",
})

/** Button-shaped action: an anchor for a destination, the vendor button for a command. */
export const Button = (props: ButtonProps) => {
    const {
        children,
        variant = "secondary",
        size = "md",
        startContent,
        endContent,
        isDisabled = false,
        isSkeleton = false,
        isPending = false,
        width = "content",
    } = props
    const unavailable = isDisabled || isPending || isSkeleton
    const content = (
        <>
            {isSkeleton ? null : isPending ? <HeroSpinner size="sm" color="current" aria-hidden="true" /> : startContent}
            <span aria-busy={isPending || undefined}>{children}</span>
            {isPending || isSkeleton ? null : endContent}
        </>
    )

    if (props.href !== undefined) {
        const { href, target, rel, download, onFollow } = props
        return (
            <a
                data-tier="atom"
                data-component="Button"
                data-element="a"
                data-loading={isSkeleton ? "true" : "false"}
                data-action-pending={isPending ? "true" : "false"}
                role={unavailable ? "link" : undefined}
                aria-disabled={unavailable || undefined}
                aria-busy={isPending || undefined}
                aria-hidden={isSkeleton || undefined}
                data-width={width}
                data-contract={width === "fill" ? "MEASURE-2" : undefined}
                className={buttonVariants({ variant: VARIANTS[variant], size: SIZES[size], fullWidth: width === "fill", className: isSkeleton ? `starci-core-button ${SKELETON_CLASS_NAME}` : "starci-core-button" })}
                {...(unavailable ? {} : { href })}
                {...(target === undefined ? {} : { target })}
                {...(rel === undefined ? target === "_blank" ? { rel: "noopener noreferrer" } : {} : { rel })}
                {...(download === undefined ? {} : { download })}
                {...(onFollow === undefined || unavailable ? {} : { onClick: onFollow })}
            >
                {content}
            </a>
        )
    }

    const { onPress, type = "button" } = props
    return (
        <HeroButton
            data-tier="atom"
            data-component="Button"
            data-element="button"
            data-loading={isSkeleton ? "true" : "false"}
            data-action-pending={isPending ? "true" : "false"}
            type={type}
            variant={VARIANTS[variant]}
            size={SIZES[size]}
            isDisabled={unavailable}
            isPending={isPending}
            data-width={width}
            data-contract={width === "fill" ? "MEASURE-2" : undefined}
            fullWidth={width === "fill"}
            className={isSkeleton ? `starci-core-button ${SKELETON_CLASS_NAME}` : "starci-core-button"}
            {...(unavailable || onPress === undefined ? {} : { onPress })}
        >
            {content}
        </HeroButton>
    )
}
