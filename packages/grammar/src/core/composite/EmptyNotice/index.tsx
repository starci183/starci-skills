import type { ReactNode } from "react"
import { Button, type ButtonVariant } from "../../primitive/Button/index.js"
import { IconTile } from "../../primitive/IconTile/index.js"
import type { IconSource } from "../../primitive/Icon/index.js"
import { Text } from "../../primitive/Text/index.js"

export type EmptyNoticeProps = {
    readonly message: string
    readonly description?: string
    /** Optional app-owned mark for the empty condition. */
    readonly iconSource?: IconSource
    readonly actionLabel?: string
    readonly actionStartContent?: ReactNode
    readonly actionVariant?: ButtonVariant
    readonly isActionPending?: boolean
    readonly onAction?: () => void
}

/** Settled empty-region answer with an optional recovery action. */
export const EmptyNotice = ({
    message,
    description,
    iconSource,
    actionLabel,
    actionStartContent,
    actionVariant = "primary",
    isActionPending = false,
    onAction,
}: EmptyNoticeProps) => (
    <div
        data-tier="composite"
        data-component="EmptyNotice"
        data-contract="GAP-3 PADDING-4"
        className="starci-core-empty-notice"
    >
        {iconSource === undefined ? null : <IconTile source={iconSource} tone="neutral" size="md" />}
        <Text size="sm" tone="muted">{message}</Text>
        {description === undefined ? null : <Text size="xs" tone="muted">{description}</Text>}
        {actionLabel === undefined ? null : (
            <Button
                variant={actionVariant}
                size="sm"
                startContent={actionStartContent}
                isPending={isActionPending}
                {...(onAction === undefined ? {} : { onPress: onAction })}
            >
                {actionLabel}
            </Button>
        )}
    </div>
)
