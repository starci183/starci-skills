import { Text } from "@starci/grammar/common"
import { MoneyText } from "@/components/leaves/MoneyText"

/** Props for OrderSummary: facts plus their resolved terms. */
export type OrderSummaryProps = {
    readonly customer: string
    readonly code: string
    readonly amount: number
    readonly customerTerm: string
    readonly amountTerm: string
    readonly isSkeleton?: boolean
}

/** Composite: several leaves in one reusable unit. No interaction, no product data of its own. */
export const OrderSummary = (props: OrderSummaryProps) => (
    <dl>
        <dt><Text tone="muted" isSkeleton={props.isSkeleton}>{props.customerTerm}</Text></dt>
        <dd><Text isSkeleton={props.isSkeleton}>{props.customer} · {props.code}</Text></dd>
        <dt><Text tone="muted" isSkeleton={props.isSkeleton}>{props.amountTerm}</Text></dt>
        <dd><MoneyText value={props.amount} isSkeleton={props.isSkeleton} /></dd>
    </dl>
)
