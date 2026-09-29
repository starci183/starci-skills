import { SectionHeader, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { SendAttempt } from "@/modules/api/sales"
import type { Slot, SlotLabels } from "@/modules/slot"

/** Shape of the block: one drawing. */
export type SendHistoryBlockState = "list"

/** Atoms only: one slot, the title and its status copy. */
export type SendHistoryBlockData = {
    readonly attempts: Slot<ReadonlyArray<SendAttempt>>
    readonly title: string
    readonly slotLabels: SlotLabels
}

/** Actions the pure half emits. */
export type SendHistoryBlockActions = { readonly retry: () => void }

/** Complete input of SendHistoryBlockBase. */
export type SendHistoryBlockBaseProps = {
    readonly state: SendHistoryBlockState
    readonly props: SendHistoryBlockData
    readonly on: SendHistoryBlockActions
}

const attemptsPlaceholder: ReadonlyArray<SendAttempt> = [{ id: "placeholder", at: "00:00 00/00", result: "Sample result" }]

/** Pure half. A secondary slot: on 403 it disappears instead of saying so. */
export const SendHistoryBlockBase = (props: SendHistoryBlockBaseProps) => (
    <section aria-label={props.props.title}>
        <SectionHeader title={props.props.title} />
        <SlotView
            slot={props.props.attempts}
            placeholder={attemptsPlaceholder}
            labels={props.props.slotLabels}
            forbidden="hide"
            onRetry={props.on.retry}
        >
            {(items, isSkeleton) => (
                <ul>
                    {items.map((attempt) => (
                        <li key={attempt.id}><Text isSkeleton={isSkeleton}>{attempt.at} · {attempt.result}</Text></li>
                    ))}
                </ul>
            )}
        </SlotView>
    </section>
)
