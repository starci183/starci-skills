import { useState } from "react"
import { List, ListItem, SurfaceAccordionCard, Text } from "@starci/grammar/common"
import type { OrderLine } from "@/modules/types"

/** Props for OrderDisclosure. */
type OrderDisclosureProps = {
    readonly lines: ReadonlyArray<OrderLine>
    readonly title: string
}

/**
 * Branch: owns intrinsic browser interaction (open / closed) and nothing else.
 * Open is not a drawn shape and not product state.
 */
export const OrderDisclosure = (props: OrderDisclosureProps) => {
    const [isOpen, setIsOpen] = useState(false)
    return (
        <SurfaceAccordionCard
            label={props.title}
            depth="nested"
            items={[{ id: "lines", isOpen, summaryRender: props.title, bodyRender: props.lines }]}
            onItemOpenChange={(_id, open) => setIsOpen(open)}
            renderSummary={(summary) => <Text weight="medium">{summary}</Text>}
            renderBody={(lines) => (
                <List>
                    {lines.map((line) => (
                        <ListItem key={line.sku}>
                            <Text>
                                {line.sku} × {line.qty}
                            </Text>
                        </ListItem>
                    ))}
                </List>
            )}
        />
    )
}
