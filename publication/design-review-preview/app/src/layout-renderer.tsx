import type { HtmlPreviewState, LayoutCandidate } from "./types"

type LayoutRendererProps = {
  readonly candidate: LayoutCandidate
  readonly state: HtmlPreviewState
}

export const LayoutRenderer = ({candidate, state}: LayoutRendererProps) => (
  <iframe
    className="authored-preview"
    style={{height: `${state.viewport.height}px`}}
    title={`${candidate.id} ${state.id} layout preview`}
    srcDoc={state.html}
    sandbox="allow-scripts"
  />
)
