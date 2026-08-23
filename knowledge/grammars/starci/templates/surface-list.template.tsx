/** Durable StarCi template: comparable peers share one joined surface owner. */
type SurfaceListItem = { readonly id: string; readonly title: string; readonly fact?: string }
type SurfaceListProps = { readonly label?: string; readonly items: ReadonlyArray<SurfaceListItem> }
declare const SurfaceList: (props: SurfaceListProps) => JSX.Element

export const SurfaceListTemplate = (props: SurfaceListProps) => (
    <SurfaceList label={props.label} items={props.items} />
)

export const invariants = {
    boundaryOwners: 1,
    rowsOwnContent: true,
    dividersReachSharedEdges: true,
} as const
