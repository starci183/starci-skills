"use client"

import { Button, Text } from "@starci/grammar/common"

/** Resolved labels and local action outcome for the clear control. */
export type ClearCartControlBaseProps = {
    readonly state: "ready"
    readonly props: {
        readonly clearLabel: string
        readonly clearingLabel: string
        readonly refusedLabel: string
        readonly refused: boolean
        readonly pending: boolean
    }
    readonly on: { readonly onPress: () => void }
}

/** Draws the clear control from its resolved action state. */
export const ClearCartControlBase = (props: ClearCartControlBaseProps) => (
    <>
        <Button variant="secondary" size="sm" onPress={props.on.onPress} isPending={props.props.pending} isDisabled={props.props.pending}>
            {props.props.pending ? props.props.clearingLabel : props.props.clearLabel}
        </Button>
        {props.props.refused ? <Text as="span" size="sm" live="assertive">{props.props.refusedLabel}</Text> : null}
    </>
)
