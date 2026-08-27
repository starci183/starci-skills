# Execute frontend UI direction

1. Validate input and local analysis.
2. Run only `fe/ui-direction`.
3. Validate its typed direction artifact and `payload.reviewPreview`. Resolve the preview artifact to its absolute executor-side HTML path, generate the content reference only with `node <Source>/.claude/scripts/visualize-directive.mjs <absolute-path>`, and paste stdout unchanged into the review response. Never handwrite or interpolate the `visualize` JSON. Stop before the review handoff or any `OK UI DIRECTION` command if the helper fails or the preview is not visibly rendered in that same response.
4. Preserve the chosen candidate until consumer acknowledgement; purge all other session artifacts.

## CONTEXT BY STATE

| State | Allowed | Forbidden |
| --- | --- | --- |
| `generate` | business outcome, current-experience evidence, direction knowledge | raw repository, UX and implementation context |
