import { Text } from "@starci/grammar/common"

/** Input of MoneyText: the amount already rendered in the reader's language by the connected half. */
type MoneyTextProps = {
    readonly value: string
    readonly isSkeleton?: boolean
}

/** Leaf: one amount, drawn with its own weight. No state, no hook, no word it resolves itself. */
export const MoneyText = (props: MoneyTextProps) => (
    <Text weight="medium" isSkeleton={props.isSkeleton}>
        {props.value}
    </Text>
)
