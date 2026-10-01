import { ErrorNotice } from "@ecommerce/ui"

/** The error page's resolved inputs: both words arrived already settled. */
type ShopErrorPageBaseProps = {
    readonly title: string
    readonly retryLabel: string
}

/** The error page's one command: retry the segment. */
type ShopErrorPageBaseOn = { readonly retry: () => void }

/** What the error page reads: the one situation it draws, its resolved words and its retry. */
type ShopErrorPageBaseContract = {
    readonly state: "ready"
    readonly props: ShopErrorPageBaseProps
    readonly on: ShopErrorPageBaseOn
}

/** The pure error page of the shop: the screen a render failure shows, drawn from resolved words and one retry. */
export const ShopErrorPageBase = (props: ShopErrorPageBaseContract) => (
    <ErrorNotice title={props.props.title} retryLabel={props.props.retryLabel} onRetry={props.on.retry} />
)
