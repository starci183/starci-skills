# Execute layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@layout-composition` | `fe.layout-composition` | qdrant | compose Blocks by hierarchy, density, span, persistence and responsive transformation |

1. Run `node validate-input.mjs <input.json>`. Stop on an unknown field, stale hash, missing block owner or missing approved-flow evidence.
2. Reconstruct the journey as page boundaries plus one shared journey-progress owner when the flow is ordered and multi-page.
3. Rank blocks by dominant task, decision dependency, data volume and frequency of reference. Treat `col-span-2`, `col-span-1` and sticky as consequences to explain, never defaults.
4. Generate two or three complete directions. Vary a real composition decision such as task-first sequencing, primary/supporting track balance, progressive disclosure or comparison strategy.
5. For every page in every direction, write wide, intermediate and compact grids, block placements, reading order, responsive transformations and persistence decisions.
6. Reject a direction that drops content or capability, uses tabs for a journey, makes a rail sticky because space exists, or changes semantics between viewports.
7. Compare the directions on task clarity, journey continuity, scan cost, responsive resilience and implementation risk. Recommend one without approving it.
8. Run `node validate-output.mjs <output.json>`. Emit nothing unless it passes; then persist it by content hash and wait for `OK LAYOUT <id>`.

On rejection, preserve the approved flow and page/state hashes, incorporate the supplied feedback, and replace the direction batch. Do not silently mutate a previously hashed direction.
