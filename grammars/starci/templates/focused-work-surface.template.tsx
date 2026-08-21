/** Durable StarCi template: live evaluated work owns the viewport; result states restore chrome. */
type FocusedSurfaceProps = { readonly live: boolean; readonly result: boolean }
declare const PersistentChrome: () => JSX.Element
declare const WorkHeader: () => JSX.Element
declare const WorkBody: (props: { readonly fullViewport: boolean }) => JSX.Element

export const FocusedWorkSurfaceTemplate = (props: FocusedSurfaceProps) => (
    <div>
        {!props.live || props.result ? <PersistentChrome /> : null}
        {props.live && !props.result ? <WorkHeader /> : null}
        <WorkBody fullViewport={props.live && !props.result} />
    </div>
)

export const invariants = {
    sharedRoutePredicate: true,
    liveAssistantVisible: false,
    resultRestoresChrome: true,
} as const
