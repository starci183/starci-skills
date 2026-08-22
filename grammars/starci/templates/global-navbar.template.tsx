/** Durable StarCi template: one capability-backed global navbar across authenticated console viewports. */
type GlobalNavbarProps = {
    readonly brand: JSX.Element
    readonly productContext: JSX.Element
    readonly evidencedTools: ReadonlyArray<JSX.Element>
    readonly mobileNavigationTrigger?: JSX.Element
}
declare const GlobalNavbar: (props: {
    readonly identity: JSX.Element
    readonly tools: ReadonlyArray<JSX.Element>
}) => JSX.Element
declare const IdentityRun: (props: { readonly children: ReadonlyArray<JSX.Element> }) => JSX.Element

export const GlobalNavbarTemplate = (props: GlobalNavbarProps) => (
    <GlobalNavbar
        identity={<IdentityRun>{[props.brand, props.productContext]}</IdentityRun>}
        tools={[
            ...props.evidencedTools,
            ...(props.mobileNavigationTrigger === undefined ? [] : [props.mobileNavigationTrigger]),
        ]}
    />
)

export const invariants = {
    oneOwnerAcrossViewports: true,
    unsupportedActions: "absent",
    persistentDestinations: "rail-or-mobile-replacement",
    duplicateDestinationLinks: false,
} as const
