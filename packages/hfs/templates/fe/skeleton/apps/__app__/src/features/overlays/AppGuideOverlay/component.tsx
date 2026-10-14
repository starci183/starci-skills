import { Button, Dialog, Text } from "@starci/grammar/common"
import { Icon } from "@/components/leaves/Icon"

/** The guide's copy, local open state and action supplied by the connected overlay. */
export type AppGuideOverlayBaseProps = {
    readonly props: {
        readonly isOpen: boolean
        readonly triggerLabel: string
        readonly title: string
        readonly description: string
        readonly closeLabel: string
    }
    readonly on: { readonly openChange: (isOpen: boolean) => void }
}

/** A keyboard-accessible grammar dialog whose trigger and dismiss actions update the same local state. */
export const AppGuideOverlayBase = (props: AppGuideOverlayBaseProps) => (
    <Dialog
        isOpen={props.props.isOpen}
        onOpenChange={props.on.openChange}
        title={props.props.title}
        closeLabel={props.props.closeLabel}
        trigger={<Button variant="secondary" startContent={<Icon />}>{props.props.triggerLabel}</Button>}
    >
        <Text>{props.props.description}</Text>
    </Dialog>
)
