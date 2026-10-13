import { Button, Text } from "@starci/grammar/common"

/** Copy, state and action supplied by the connected sign-out block. */
export interface SignOutButtonBaseProps {
    readonly props: {
        readonly principal: string
        readonly label: string
        readonly pending: boolean
    }
    readonly on: { readonly press: () => void }
}

/** Draws the signed-in reader and the sign-out control without reading navigation, copy or session state. */
export const SignOutButtonBase = (props: SignOutButtonBaseProps) => (
    <>
        <Text>{props.props.principal}</Text>
        <Button variant="secondary" isPending={props.props.pending} onPress={props.on.press}>
            {props.props.label}
        </Button>
    </>
)
