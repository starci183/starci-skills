import { Button, Heading, SurfaceCard, Text } from "@starci/grammar/common"
import { exampleBlockActionsClassName, exampleBlockBodyClassName } from "./classNames"

/** Aggregate transport state for the example status block. */
export type ExampleBlockState = "pending" | "ready" | "failed"

/** Localized copy consumed by the pure renderer. */
export type ExampleBlockLabels = {
    readonly title: string
    readonly pendingMessage: string
    readonly failedMessage: string
    readonly retryLabel: string
    readonly detailsLabel: string
    readonly helpLabel: string
}

/** Resolved facts already formatted by the connected owner. */
export type ExampleBlockData = {
    readonly labels: ExampleBlockLabels
    readonly value?: string
    readonly detailsHref: string
}

/** User actions emitted by the pure renderer. */
export type ExampleBlockActions = {
    readonly retry: () => void
    readonly openHelp: () => void
}

/** Complete pure-renderer input for the example status block. */
export type ExampleBlockProps = {
    readonly state: ExampleBlockState
    readonly props: ExampleBlockData
    readonly on: ExampleBlockActions
}

/**
 * Pure status renderer.
 *
 * Receives resolved state, labels, data and actions only. Fetching, routing and
 * localization remain in the connected owner. Destination Buttons use href;
 * command Buttons use onPress — never both on one control.
 */
export const ExampleBlockBase = (props: ExampleBlockProps) => {
    const { labels, value, detailsHref } = props.props
    return (
        <SurfaceCard composition="joined">
            <div className={exampleBlockBodyClassName}>
                <Heading level={2}>{labels.title}</Heading>
                {props.state === "pending" ? (
                    <Text tone="muted">{labels.pendingMessage}</Text>
                ) : null}
                {props.state === "ready" ? <Text>{value}</Text> : null}
                {props.state === "failed" ? (
                    <Text tone="muted">{labels.failedMessage}</Text>
                ) : null}
                {props.state === "pending" ? null : (
                    <div className={exampleBlockActionsClassName}>
                        {props.state === "failed" ? (
                            <Button variant="primary" onPress={props.on.retry}>
                                {labels.retryLabel}
                            </Button>
                        ) : null}
                        <Button variant="secondary" href={detailsHref}>
                            {labels.detailsLabel}
                        </Button>
                        <Button variant="tertiary" onPress={props.on.openHelp}>
                            {labels.helpLabel}
                        </Button>
                    </div>
                )}
            </div>
        </SurfaceCard>
    )
}
