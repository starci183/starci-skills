import { Button, Text } from "@starci/grammar/common"

/** Resolved labels and local action outcome for the add control. */
export type AddToCartControlBaseProps = {
    readonly props: {
        readonly addLabel: string
        readonly addingLabel: string
        readonly inCartLabel: string
        readonly refusedLabel: string
        readonly quantity: number
        readonly refused: boolean
        readonly pending: boolean
    }
    readonly on: { readonly onPress: () => void }
}

/** Draws one product's add control from its resolved action state. */
export const AddToCartControlBase = (props: AddToCartControlBaseProps) => (
    <>
        <Button
            variant="primary"
            size="sm"
            onPress={props.on.onPress}
            isPending={props.props.pending}
            isDisabled={props.props.pending}
        >
            {props.props.pending ? props.props.addingLabel : props.props.addLabel}
        </Button>
        {props.props.quantity > 0 ? (
            <Text as="p" size="sm" tone="muted">
                {props.props.inCartLabel.replace("{count}", String(props.props.quantity))}
            </Text>
        ) : null}
        {props.props.refused ? (
            <Text as="p" size="sm" live="assertive">
                {props.props.refusedLabel}
            </Text>
        ) : null}
    </>
)
