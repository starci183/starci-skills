/** Durable StarCi template: one labelled task form owns its fields, status and actions. */
type SurfaceFormProps = { readonly label: string; readonly form: JSX.Element }
declare const SurfaceForm: (props: SurfaceFormProps) => JSX.Element

export const SurfaceFormTemplate = (props: SurfaceFormProps) => (
    <SurfaceForm label={props.label} form={props.form} />
)

export const invariants = {
    boundaryOwners: 1,
    labelOutsideSurface: true,
    formOwnsFieldsStatusAndActions: true,
} as const
