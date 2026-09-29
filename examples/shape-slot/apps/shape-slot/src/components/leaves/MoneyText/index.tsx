import { Text } from "@starci/grammar/common"

/** Input of MoneyText. */
export type MoneyTextProps = {
    readonly value: number
    readonly isSkeleton?: boolean
}

/** Leaf: one formatted amount in VND. No state, no hook. */
export const MoneyText = (props: MoneyTextProps) => (
    <Text isSkeleton={props.isSkeleton}>{props.value.toLocaleString("vi-VN")} ₫</Text>
)
