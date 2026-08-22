/** Durable StarCi template: a section label names one bounded body from outside its surface. */
type SurfaceCardProps = { readonly label: string; readonly body: JSX.Element }
declare const SurfaceCard: (props: SurfaceCardProps) => JSX.Element

export const SurfaceCardTemplate = (props: SurfaceCardProps) => (
    <SurfaceCard label={props.label} body={props.body} />
)

export const invariants = {
    boundaryOwners: 1,
    labelOutsideSurface: true,
    bodyOwners: 1,
} as const
