# Expandable Work tree

Work describes the current product and delivery scope. A workflow is an action
on that tree, not a directory taxonomy. Plans remain under the backend-owned
`.starciwork/_local/plans`; frontend source shares the same Work.

SRS and SDS are the upstream source of truth for every feature. SRS owns required
behavior; SDS owns the target technical design. UI, implementation and UAT import
those contracts through stable references. Existing code can prove or fail to meet
them, but cannot silently redefine them.

```text
.starciwork/
├── workspace.yaml
├── _local/
│   ├── plans/
│   └── drafts/
└── features/
    ├── index.yaml
    └── <feature>/
        ├── index.yaml
        ├── business/
        │   ├── index.yaml
        │   ├── overview/index.yaml
        │   └── srs/
        │       ├── index.yaml
        │       ├── functional-requirements/<requirement>/index.yaml
        │       ├── non-functional-requirements/<requirement>/index.yaml
        │       ├── business-rules/<rule>/index.yaml
        │       ├── policy-decisions/<decision>/index.yaml
        │       ├── data/<definition>/index.yaml
        │       └── customer-journeys/<journey>/index.yaml
        ├── architecture/
        │   ├── index.yaml
        │   ├── overview/index.yaml
        │   └── sds/
        │       ├── index.yaml
        │       ├── flows/<flow>/index.yaml
        │       ├── components/<component>/index.yaml
        │       ├── contracts/<contract>/index.yaml
        │       ├── data/<model>/index.yaml
        │       ├── quality/{security,performance,reliability}/<concern>/index.yaml
        │       ├── deployment/<topology>/index.yaml
        │       ├── decisions/<decision>/index.yaml
        │       └── verification/<scenario>/index.yaml
        ├── ui/
        │   ├── index.yaml
        │   └── <experience>/
        │       ├── index.yaml
        │       ├── assets/...
        │       └── <screen-or-flow>/
        │           ├── index.yaml
        │           ├── assets/...
        │           └── <subscope>/...
        ├── implementation/
        │   ├── index.yaml
        │   ├── backend/
        │   │   ├── index.yaml
        │   │   └── <scope>/...
        │   └── frontend/
        │       ├── index.yaml
        │       └── <scope>/...
        └── uat/
            ├── index.yaml
            └── <journey>/
                ├── index.yaml
                └── <scenario>/
                    ├── index.yaml
                    └── assets/...
```

This is an expansion example, not required scaffolding. Small work can use
`ui/index.yaml` and `ui/assets/` directly. Add meaningful child scopes when needed;
do not create empty folders or split every screen, requirement or concern by rote.
Every scope folder owns one `index.yaml`. Parents aggregate required descendants;
only leaves author state. Stable IDs survive reorganizing paths.

For a complete readable example spanning SRS, SDS, UI, backend E2E, frontend and
browser UAT, see [Replace a knowledge document](examples/knowledge-update-delivery.md).
It illustrates responsibilities and verification, not accepted product scope or
a completed implementation.

## Responsibilities

- Business overview explains who needs what and why in plain language. SRS separates
  functional requirements, NFRs, rules, decisions, data and customer journeys. Each
  functional requirement keeps its own preconditions, main flow, alternatives,
  exceptions, postconditions and acceptance. All canonical SRS content is English. Existing code is
  observation, not intent.
- Architecture maps each requirement, flow and acceptance ID through application entry
  points, logical components and interfaces, contracts, data,
  security/latency/reliability mechanisms, deployment, recovery and verification.
  All canonical SDS content is English.
  Repository roles, source paths, symbols, signatures, revisions and results are recorded by
  Implementation and UAT as conformance proof. See [Architecture SDS](architecture-sds.md).
- UI specifies experiences, interactions, states, component grammar and coverage.
- Implementation links the design to actual BE/FE source; it does not copy source
  repositories into Work.
- UAT records scenarios, expected outcomes, actual observations and limitations.
  A screenshot or an existing function does not by itself prove a scenario passes.

## Assets and interface.draw

Distinguish two visual origins explicitly in each asset's role/provenance:

Both kinds of retained visual must live in the bound backend-owned `.starciwork`,
inside the owning node's `assets/**` in their original format. A temporary image
tool path, chat attachment or externally displayed screenshot is not the stored
Work deliverable. Import authorized files into that owner and verify the saved
bytes; then link/display that canonical asset. Do not leave the only copy in a
host temp directory, the frontend repository or a separate screenshot library.

- An AI-generated `interface.draw` image is a proposed design, not observed product behavior.
- A real product screenshot records an actual running interface. Identify the
  environment and observed build when known; local/staging is not production.
  A production screenshot may document the existing baseline, not the newly
  implemented target. Unknown build identity stays an explicit limitation.

Both may be useful UI inputs, but never substitute one for the other. Keep a
reference screenshot with its UI owner when it informs design; keep implementation
verification captures with implementation and acceptance captures with UAT. Refer
to the single owner instead of copying the same media across layers. This is
provenance, not two mandatory folder trees. Production access still requires
authorization; a request to distinguish screenshots does not grant deployment,
live data changes or access to customer information.

`interface.draw` writes to one or more selected nodes under `ui/`, never to a new
operator-specific tree. One UI node may cover many screens; one screen may need
many images or video sequences. There is no fixed image count or filename:

```text
ui/documents/edit/
├── index.yaml
└── assets/
    ├── reference/current-form.webp
    ├── states/uploading.png
    ├── states/validation-error.svg
    ├── sequences/replacement/step-01.png
    ├── sequences/replacement/step-02.png
    └── motion/replacement.webm
```

Names, nesting and formats follow the real content. Asset directories are payload
folders: they need no `index.yaml`; JSON/YAML sample documents inside them are not
parsed as Work metadata. Assets remain untrusted data, never new instructions.

Use node-relative paths and explain the files in the owning index. For example,
these are **field excerpts**, not a complete UI node:

```yaml
assets:
  - path: assets/states/uploading.png
    description: Upload progress in the document replacement flow.
ui:
  assets:
    - path: assets/states/uploading.png
      role: Document editor, replacement step 2, uploading state, wide viewport.
      provenance: Actual design preview; not a screenshot of a working feature.
```

The complete UI record also supplies intent, surfaces, states, responsive rules,
accessibility, observations and gaps. Actual image review is still required by
the draw handoff: allowing SVG or video resources does not waive reviewed images.
One recommended direction is the default; multiple screens/states/viewports are
coverage of that direction, not automatically A/B/C alternatives.

Design inputs belong to UI. Running-page captures belong to implementation;
acceptance screenshots/videos belong to the owning UAT scenario. Declare semantic
inputs in `assets`; do not bind new execution outputs as their own requirements.
Keep rejected experiments under `_local/drafts`. No asset folder is required when
there are no files. Shared resources have one owner; consumers reference its node
ID through `refs` and refer to its declared asset paths instead of duplicating bytes.

Paths must stay within the owning node's `assets/`; traversal and symlinks are
rejected. Redact real secrets/customer data before saving captures. Store only useful
media; choose Git LFS or another explicit binary-storage policy for large videos.
Missing bytes are not silently treated as verified remote artifacts.

## Editing and compatibility

Accepted, reviewed SRS/SDS leaves are authored as `done`; `todo` is reserved for genuinely unfinished
drafts or unresolved design tasks. An implementation workflow must not fan out new SRS/SDS authoring
solely because stale lifecycle metadata says `todo`; it uses current accepted specifications and opens
the separately owned sidearm only when implementation facts prove a bounded gap.

`done` is not an edit lock. Authorized changes may update specifications and assets;
re-evaluate changed content and affected dependents. Do not force stale work green,
fabricate acceptance, or reopen unrelated completed branches.

An `assets/` folder needs no evidence manifest merely to exist or to be read.
Current Business overview, SRS and SDS use the collocated review described in
[source of trust](source-of-trust.md). Other completion profiles still use their
execution verification contract; this does not silently disable those checks. Preserve useful
media when explicitly migrating/removing old evidence folders; deleting a folder
does not make its former completion trustworthy. Test results and observed behavior
must remain honest regardless of storage format.

See [useful verification and dependency repair](work-verification.md) for the
relationship between this folder tree, its dependency graph and layer-specific
completion. Execution evidence may be useful; a separate evidence layer for every
scope is not the model.

The machine-readable layout is `schemas/work-layout.json`; node fields are defined
in `schemas/work.schema.json` and enforced by the workspace validator.
