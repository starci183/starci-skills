# Frontend runtime and capture readiness

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.runtime-capture-readiness` |
| Operators | `fe/capture-preflight, fe/render-capture` |
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

The frozen `populatedHeroStateRef` is the primary proof state. It must be a reachable happy-case state
with populated approved data and the core task visibly active before capture begins. A loading,
skeleton, error, recovery, empty, invented, or fixture-backed state cannot substitute for it. Every
other frozen state and every wide/intermediate/compact cell remains required; the hero rule identifies
the first user-outcome proof, not a waiver for the rest of the matrix.

Classify dependency containment, target build/load, and viewport effectiveness as runtime or capture
readiness. Track repository reproducibility as an adjacent receipt whose drift cannot silently become a
capture pass or an unconditional capture blocker. Route missing backend data to its backend owner, but
route a broken harness or unsupported worktree dependency strategy as `blocked`; never disguise either
as a product-source repair.

Missing live records remain a typed backend gap. They cannot be disguised with capture fixtures,
invented product data, a skeleton, or a recovery state. Capture resumes only after the exact backend
owner returns current data evidence for the frozen primary state and source identity.
