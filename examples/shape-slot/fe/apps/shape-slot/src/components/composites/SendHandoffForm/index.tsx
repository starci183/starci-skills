import { Button, Input, Text } from "@starci/grammar/common"
import { DrawerBranch } from "@/components/branches/DrawerBranch"

/** Shape of the send form: each value is one drawing. Open / closed is an atom, not a shape. */
export type SendHandoffFormState = "form" | "confirm"

/** Localized copy resolved by the connected half. */
type SendHandoffFormLabels = {
    readonly title: string
    readonly fingerprint: string
    readonly revision: string
    readonly note: string
    readonly review: string
    readonly confirmQuestion: string
    readonly back: string
    readonly confirm: string
}

/** One field as atoms: its value and its already-translated error, if any. */
type SendHandoffFormField = {
    readonly value: string
    readonly error?: string
}

/** Atoms only: react-hook-form stays in the connected half; the composite sees values and errors. */
export type SendHandoffFormData = {
    readonly isOpen: boolean
    readonly isSending: boolean
    readonly fingerprint: SendHandoffFormField
    readonly revision: SendHandoffFormField
    readonly note: SendHandoffFormField
    readonly labels: SendHandoffFormLabels
}

/** Actions the composite emits; every argument is an atom. */
type SendHandoffFormActions = {
    readonly close: () => void
    readonly change: (field: "fingerprint" | "revision" | "note", value: string) => void
    readonly review: () => void
    readonly back: () => void
    readonly confirm: () => void
}

/** Complete input of SendHandoffForm. */
type SendHandoffFormProps = {
    readonly state: SendHandoffFormState
    readonly props: SendHandoffFormData
    readonly on: SendHandoffFormActions
}

/** Pure composite: a drawer in one of two shapes. */
export const SendHandoffForm = (props: SendHandoffFormProps) => {
    const { labels, fingerprint, revision, note } = props.props
    return (
        <DrawerBranch isOpen={props.props.isOpen} title={labels.title} onDismiss={props.on.close}>
            {props.state === "form" ? (
                <>
                    <Input
                        id="send-fingerprint"
                        name="fingerprint"
                        label={labels.fingerprint}
                        value={fingerprint.value}
                        isError={fingerprint.error !== undefined}
                        errorMessage={fingerprint.error}
                        isRequired
                        onValueChange={(value) => props.on.change("fingerprint", value)}
                    />
                    <Input
                        id="send-revision"
                        name="revision"
                        label={labels.revision}
                        value={revision.value}
                        isError={revision.error !== undefined}
                        errorMessage={revision.error}
                        isRequired
                        onValueChange={(value) => props.on.change("revision", value)}
                    />
                    <Input
                        id="send-note"
                        name="note"
                        label={labels.note}
                        value={note.value}
                        isError={note.error !== undefined}
                        errorMessage={note.error}
                        onValueChange={(value) => props.on.change("note", value)}
                    />
                    <Button variant="primary" width="fill" onPress={props.on.review}>
                        {labels.review}
                    </Button>
                </>
            ) : null}
            {props.state === "confirm" ? (
                <>
                    <Text>{labels.confirmQuestion}</Text>
                    <Button variant="secondary" width="fill" onPress={props.on.back}>
                        {labels.back}
                    </Button>
                    <Button variant="primary" width="fill" isPending={props.props.isSending} onPress={props.on.confirm}>
                        {labels.confirm}
                    </Button>
                </>
            ) : null}
        </DrawerBranch>
    )
}
