"use client"

import { SurfaceListCard, Text } from "@starci/grammar/common"
import type { LineItemRow } from "../../../modules/types"
import { lineItemsCardClassNames } from "./classNames"

/** The card's resolved inputs: its title, the total it carries as its fact, and the lines with every string settled. */
type LineItemsCardProps = {
    readonly label: string
    readonly total: string
    readonly lines: ReadonlyArray<LineItemRow>
}

/** One card of order lines - name, quantity and line total each - shared by the cart and the checkout summary. */
export const LineItemsCard = (props: LineItemsCardProps) => (
    <SurfaceListCard label={props.label} fact={props.total}>
        {props.lines.map((line) => (
            <li className={lineItemsCardClassNames.row} key={line.productId}>
                <span>
                    <Text as="span" weight="semibold">
                        {line.name}
                    </Text>{" "}
                    <Text as="span" size="sm" tone="muted">
                        {line.quantityLabel}
                    </Text>
                </span>
                <span className={lineItemsCardClassNames.rowAside}>
                    <Text as="span" weight="semibold">
                        {line.lineTotal}
                    </Text>
                </span>
            </li>
        ))}
    </SurfaceListCard>
)
