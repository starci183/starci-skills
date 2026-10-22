import { Button, SurfaceCard, Text } from "@starci/grammar/common"

/** The confirmed order's surface, resolved: its heading, its line, the replay note and the receipt and account ways out. */
type ConfirmedOrder = {
    readonly title: string
    /** The order's id, status and total in one sentence. */
    readonly line: string
    /** The replay note when the service answered the first confirmation again, else `null`. */
    readonly replayedNote: string | null
    readonly receiptLabel: string
    readonly receiptPendingLabel: string
    readonly receiptPending: boolean
    /** Why the last receipt press did not download, `null` before a press or after a download. */
    readonly receiptFailure: string | null
    readonly accountCta: string
    readonly accountHref: string
}

/** The confirm control's resolved inputs: its words, the confirmed order (if any) and the refusal of the last attempt. */
export type ConfirmOrderPanelProps = {
    readonly props: {
        readonly confirmLabel: string
        readonly confirmingLabel: string
        readonly pending: boolean
        /** The line naming what the service refused and why, `null` when the last attempt was not refused. */
        readonly refusal: string | null
        readonly confirmed: ConfirmedOrder | null
    }
    readonly on: {
        readonly onPress: () => void
        /** Downloads the receipt of the confirmed order. */
        readonly onReceipt: () => void
    }
}

/**
 * Draws the service's confirmation or refusal and keeps the confirm button available for replay. A confirmed order offers
 * its receipt download beside the way to the account.
 */
export const ConfirmOrderPanel = (props: ConfirmOrderPanelProps) => {
    const values = props.props
    const confirmed = values.confirmed
    return (
        <>
            {confirmed ? (
                <SurfaceCard label={confirmed.title}>
                    <Text as="p" size="sm">
                        {confirmed.line}
                    </Text>
                    {confirmed.replayedNote ? (
                        <Text as="p" size="sm" tone="muted">
                            {confirmed.replayedNote}
                        </Text>
                    ) : null}
                    <Button
                        variant="secondary"
                        size="sm"
                        onPress={props.on.onReceipt}
                        isPending={confirmed.receiptPending}
                        isDisabled={confirmed.receiptPending}
                    >
                        {confirmed.receiptPending ? confirmed.receiptPendingLabel : confirmed.receiptLabel}
                    </Button>
                    {confirmed.receiptFailure ? (
                        <Text as="p" size="sm" live="polite">
                            {confirmed.receiptFailure}
                        </Text>
                    ) : null}
                    <Button href={confirmed.accountHref} variant="secondary" size="sm">
                        {confirmed.accountCta}
                    </Button>
                </SurfaceCard>
            ) : null}
            <Button
                variant="primary"
                size="sm"
                onPress={props.on.onPress}
                isPending={values.pending}
                isDisabled={values.pending}
            >
                {values.pending ? values.confirmingLabel : values.confirmLabel}
            </Button>
            {values.refusal ? (
                <Text as="p" size="sm" live="assertive">
                    {values.refusal}
                </Text>
            ) : null}
        </>
    )
}
