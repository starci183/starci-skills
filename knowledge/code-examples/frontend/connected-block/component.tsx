import { Button, Heading, SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { Slot, SlotLabels } from "@/modules/slot"
import { exampleBlockActionsClassName, exampleBlockBodyClassName } from "./classNames"

/**
 * Shape of the block: each value is exactly one drawing.
 * Loading, forbidden, error and empty are NOT shapes; they are the slot's data status.
 */
export type ExampleBlockState = "summary" | "detail"

/** Shape used while the slot is still loading, so the skeleton has a tree to follow. */
export const exampleBlockDefaultState: ExampleBlockState = "summary"

/** The status one api returns. */
export type ExampleStatus = {
    readonly value: string
    readonly checks: ReadonlyArray<string>
}

/** Localized copy consumed by the pure renderer. */
export type ExampleBlockLabels = {
    readonly title: string
    readonly detailsLabel: string
    readonly helpLabel: string
    readonly status: SlotLabels
}

/** Atoms only: one slot per api, labels and a destination. */
export type ExampleBlockData = {
    readonly status: Slot<ExampleStatus>
    readonly labels: ExampleBlockLabels
    readonly detailsHref: string
}

/** User actions emitted by the pure renderer; arguments are atoms. */
export type ExampleBlockActions = {
    readonly retry: () => void
    readonly openHelp: () => void
}

/** Complete pure-renderer input for the example status block. */
export type ExampleBlockBaseProps = {
    readonly state: ExampleBlockState
    readonly props: ExampleBlockData
    readonly on: ExampleBlockActions
}

const statusPlaceholder: ExampleStatus = { value: "Sample status", checks: ["Sample check"] }

/**
 * Pure status renderer.
 *
 * Draws one of two shapes; the slot renders its own data status through SlotView.
 * Fetching, routing and localization remain in the connected owner. Destination Buttons use
 * href; command Buttons use onPress, never both on one control.
 */
export const ExampleBlockBase = (props: ExampleBlockBaseProps) => {
    const { labels, detailsHref } = props.props
    return (
        <SurfaceCard label={labels.title}>
            <div className={exampleBlockBodyClassName}>
                <Heading level={2}>{labels.title}</Heading>
                <SlotView slot={props.props.status} placeholder={statusPlaceholder} labels={labels.status} onRetry={props.on.retry}>
                    {(status, isSkeleton) => (
                        <>
                            <Text isSkeleton={isSkeleton}>{status.value}</Text>
                            {props.state === "detail" ? (
                                <ul>
                                    {status.checks.map((check) => (
                                        <li key={check}><Text tone="muted" isSkeleton={isSkeleton}>{check}</Text></li>
                                    ))}
                                </ul>
                            ) : null}
                        </>
                    )}
                </SlotView>
                <div className={exampleBlockActionsClassName}>
                    <Button variant="secondary" href={detailsHref}>{labels.detailsLabel}</Button>
                    <Button variant="tertiary" onPress={props.on.openHelp}>{labels.helpLabel}</Button>
                </div>
            </div>
        </SurfaceCard>
    )
}
