"use client"

import { Button } from "@starci/grammar/common"

/** The pure sign-out action's resolved inputs: the one label and the one press. */
export type SignOutActionProps = {
    /** Whole-action situations; pending belongs to the press that started it. */
    readonly state: "ready" | "working"
    /** The data payload for whatever state is showing. */
    readonly props: {
        readonly label: string
    }
    /** What the surface reports upward. */
    readonly on: {
        readonly onSignOut: () => void
    }
}

/** The sign-out press beside the account title; pending withholds a duplicate press. */
export const SignOutActionBase = (props: SignOutActionProps) => (
    <Button
        variant="secondary"
        size="sm"
        isPending={props.state === "working"}
        isDisabled={props.state === "working"}
        onPress={props.on.onSignOut}
    >
        {props.props.label}
    </Button>
)
