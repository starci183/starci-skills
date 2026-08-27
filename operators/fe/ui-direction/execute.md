# Execute `fe/ui-direction`

## Step 1 — Frame the design problem

**Read:** the approved business outcome and current-experience evidence only. **Context:** distinguish desired outcome from observed source. **Session write:** a problem frame with hierarchy, trust, navigation, density, and interaction tensions. **Stop:** when business authority is missing or stale.

## Step 2 — Generate independent directions

**Read:** the exact knowledge bindings below. **Context:** in `deep` or `parallel`, orchestration assigns independent workers before any worker sees another proposal. **Session write:** three or four materially different directions with explicit tradeoffs plus one accessible interactive HTML review that renders every direction, the closed important surface set, and wide, intermediate, and compact states. Bind the HTML as `payload.reviewPreview`; prose or a code block is not a preview. **Stop:** when differences are merely color, spacing, or naming, or when the visual review is incomplete.

## Step 3 — Compare and emit

**Read:** only candidate artifacts and the problem frame. **Context:** source is evidence, not design authority. **Session write:** recommendation, comparison axes, evidence refs, exact `OK UI DIRECTION <id>@<preview-hash>` commands, and state. Validate the output, resolve `payload.reviewPreview.artifactRef` to its absolute executor-side HTML path, then generate the content reference only with `node <Source>/.claude/scripts/visualize-directive.mjs <absolute-path>` and paste stdout unchanged into the review response. Never handwrite or interpolate the directive JSON. **Stop:** before implementation or UX-flow invention, when the helper fails, or when the preview is not visibly rendered in the same response.
