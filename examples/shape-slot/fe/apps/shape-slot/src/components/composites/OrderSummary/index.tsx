import { DescriptionList, Text } from "@starci/grammar/common"
import { MoneyText } from "@/components/leaves/MoneyText"

/** Props for OrderSummary: facts plus their resolved terms; the amount arrives already formatted. */
type OrderSummaryProps = {
    readonly customer: string
    readonly code: string
    readonly amount: string
    readonly customerTerm: string
    readonly amountTerm: string
    readonly isSkeleton?: boolean
}

/** Composite: several leaves in one reusable unit. No interaction, no product data of its own. */
export const OrderSummary = (props: OrderSummaryProps) => (
    <DescriptionList
        layout="stacked"
        items={[
            {
                id: "customer",
                term: (
                    <Text tone="muted" isSkeleton={props.isSkeleton}>
                        {props.customerTerm}
                    </Text>
                ),
                description: (
                    <Text isSkeleton={props.isSkeleton}>
                        {props.customer} · {props.code}
                    </Text>
                ),
            },
            {
                id: "amount",
                term: (
                    <Text tone="muted" isSkeleton={props.isSkeleton}>
                        {props.amountTerm}
                    </Text>
                ),
                description: <MoneyText value={props.amount} isSkeleton={props.isSkeleton} />,
            },
        ]}
    />
)
