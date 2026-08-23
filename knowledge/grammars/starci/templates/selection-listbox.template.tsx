/** Durable StarCi template: a destination collection delegates selection mechanics to ListBox. */
type Destination = { readonly id: string; readonly textValue: string; readonly label: string; readonly isCurrent?: boolean }
type SelectionProps = { readonly label: string; readonly selectedKey?: string; readonly items: ReadonlyArray<Destination>; readonly activate: (id: string) => void }
declare const ListBox: (props: SelectionProps) => JSX.Element

export const SelectionListboxTemplate = (props: SelectionProps) => (
    <ListBox {...props} />
)

export const invariants = {
    selectionMode: "single",
    keyboardNavigation: true,
    itemTextValueRequired: true,
} as const
