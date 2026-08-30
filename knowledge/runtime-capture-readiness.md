# Frontend runtime and capture readiness

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.runtime-capture-readiness` |
| Operators | `fe/runtime-observe, fe/capture-preflight` |
| Search tags | `frontend, runtime, worktree, dependencies, lockfile, turbopack, viewport, capture` |
| Dependencies | `workspace.initialization, fe.ui-render-review` |

## Boundary

This record proves that a frontend runtime and its capture controls are trustworthy before product
observation or visual-review tokens are spent. It does not judge visual quality and does not authorize
product-source repair.

The runtime must execute from the routed worktree and load the exact target from that source boundary.
Its dependency tree must be either installed inside that worktree or provided by a toolchain-supported
local strategy that remains inside the toolchain filesystem root. A `node_modules` symlink or junction
that escapes the worktree is not readiness proof when the active toolchain enforces root confinement.

Before starting a runtime, verify the package manifest, lockfile, package-manager command, working
directory, listener/port, and required local package export targets. A deterministic install that fails
because manifest and lockfile disagree is a repository-reproducibility finding: it blocks clean-install
or release proof, but it does not by itself block capture when a contained dependency tree passes the
production build and loads the exact target from the frozen source. Record the drift and keep it visible.
An import whose required local export target is absent still blocks capture when the exact target cannot
build or load. Do not mutate a product manifest or lockfile merely to heal an observation or capture
harness. Reuse an existing listener only when process, origin, worktree, source fingerprint, and target
identity are all proven to match; a port collision without that proof is not a usable runtime.

Responsive controls are effective only when each requested viewport produces the same observed content
viewport dimensions and fresh, distinct raster evidence. A tool reporting that it changed a viewport is
not proof when the observed dimensions remain unchanged or responsive rasters are duplicates. Restore
the host viewport after probes and preserve the exact failure evidence when a control is ineffective.

Tool capability is separate from product behavior. When zoom is absent or inert in the active capture
surface, one bounded native attempt plus one fresh-context confirmation may establish an unsupported
tool capability. Preserve both receipts, keep the three zoom lifecycle cells explicit, and mark only
`zoom-restored` plus those cells as `not-applicable`/`tool-capability-unavailable`. This does not certify
zoom behavior; it prevents a tool-model limit from suppressing otherwise valid latest-source visual
review. A partial zoom lifecycle, duplicate raster relabeling, or use of this exception for any other
probe remains a blocker.

Classify dependency containment, target build/load, and viewport effectiveness as runtime or capture
readiness. Track repository reproducibility as an adjacent receipt whose drift cannot silently become a
capture pass or an unconditional capture blocker. Route missing backend data to its backend owner, but
route a broken harness or unsupported worktree dependency strategy as `blocked`; never disguise either
as a product-source repair.

For a frontend-only `new` or `reconstruct` mission whose backend/API boundary is frozen, missing live
records may not erase visual proof of the implemented frontend states. A capture-only contract fixture
is allowed only when it is derived from frozen frontend/API types or approved examples, content-addressed,
kept outside product source, and explicitly marked `visual-evidence-only`. It may satisfy visual
`data-ready` for the frozen state matrix while the live-data gap remains bound as `backendGapRef`.
Fixture-backed visual PASS routes to the backend owner, never to quality/UAT completion, and never proves
live integration, backend behavior, or production data. Uncontracted invented data or a fixture hidden
inside product source is a blocker, not evidence.
