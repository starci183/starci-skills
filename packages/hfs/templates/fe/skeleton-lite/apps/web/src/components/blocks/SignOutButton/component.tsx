import { Button, Text } from "@starci/grammar/common"

/** Copy, state and action supplied by the connected sign-out block. */
export interface SignOutButtonBaseProps {
    readonly props: { readonly label: string; readonly pending: boolean; readonly failure?: string }
    readonly on: { readonly press: () => void }
}

/** Draws the sign-out control without reading navigation, copy or database state. */
export const SignOutButtonBase = (props: SignOutButtonBaseProps) => (
    <>
        <Button variant="secondary" isPending={props.props.pending} onPress={props.on.press}>
            {props.props.label}
        </Button>
        {props.props.failure === undefined ? null : <Text live="assertive">{props.props.failure}</Text>}
    </>
)
