import { Button, Heading, Region } from "@starci/grammar/common"

/** The error page's resolved inputs: both words arrived already settled. */
type ErrorPageBaseProps = {
    readonly title: string
    readonly retryLabel: string
}

/** The error page's one command: retry the segment. */
type ErrorPageBaseActions = { readonly retry: () => void }

/** Complete input of ErrorPageBase. */
type ErrorPageBaseContract = {
    readonly props: ErrorPageBaseProps
    readonly on: ErrorPageBaseActions
}

/** Pure half: the screen a render failure shows, drawn from resolved words and one retry. */
export const ErrorPageBase = (props: ErrorPageBaseContract) => (
    <Region label={props.props.title}>
        <Heading level={1}>{props.props.title}</Heading>
        <Button variant="primary" onPress={props.on.retry}>
            {props.props.retryLabel}
        </Button>
    </Region>
)
