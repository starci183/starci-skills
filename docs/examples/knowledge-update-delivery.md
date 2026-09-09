# Worked example: replace a knowledge document

This synthetic example shows one feature across Business/SRS, Architecture/SDS,
UI, backend implementation including backend E2E, frontend and browser UAT.
It is not an accepted product specification, executable Work fixture, approval,
implemented feature or test report. No code, drawings or captures are supplied;
all execution results are **not-run**. Do not add these example policies to a
real project without its actual authorized requirements.

Use the published [Work schema](../../schemas/work.schema.json),
[SRS guidance](../business-srs.md) and [SDS guidance](../architecture-sds.md)
when authoring real nodes. The descriptions below are readable content, not
invented YAML keys or a substitute for validation.

## One tree, linked responsibilities

```text
.starciwork/<product>/chatbot/
├── index.yaml
├── business/
│   ├── index.yaml
│   ├── overview/index.yaml
│   └── srs/
│       ├── index.yaml
│       └── knowledge/
│           ├── index.yaml
│           └── update-document/index.yaml
├── architecture/
│   ├── index.yaml
│   ├── overview/index.yaml
│   └── sds/
│       ├── index.yaml
│       ├── document-lifecycle/index.yaml
│       └── retrieval-consistency/index.yaml
├── ui/
│   ├── index.yaml
│   └── knowledge/
│       ├── index.yaml
│       └── document-editor/
│           ├── index.yaml
│           └── assets/{reference,design}/...
├── implementation/
│   ├── index.yaml
│   ├── backend/
│   │   ├── index.yaml
│   │   └── knowledge-update/
│   │       ├── index.yaml
│   │       └── assets/test-results/...
│   └── frontend/
│       ├── index.yaml
│       └── document-editor/
│           ├── index.yaml
│           └── assets/captures/...
└── uat/
    ├── index.yaml
    └── knowledge-update/
        ├── index.yaml
        └── assets/{captures,video}/...
```

This is an expansion example, not mandatory scaffolding. Keep small scopes
together. Parents aggregate; leaves own specific content and completion.
Folders organize ownership, while typed references and dependencies form the
cross-scope graph. Shared authorization/recovery design is referenced from its
single owner, not copied here. Product code stays in the bound BE/FE sources.
Keep useful execution proof using the supported completion profile; assets alone
do not earn done. Do not create empty image folders or synthetic screenshots.

## Business overview

**Need:** A knowledge manager wants the assistant to answer using current,
authorized documents without manually repairing individual answers.

**Outcome:** Replace a document, see which version is effective, distinguish
processing from success and know what to do when replacement fails.

**Boundary:** Receiving an upload does not mean the assistant uses it. An existing
usable version remains effective until a valid replacement becomes effective.
This scope does not grant new sharing rights or authorize messages to customers.

## Business SRS: FR-KNOW-03

**Actors:** the authorized knowledge manager initiates replacement; the system
checks and processes it; an assistant user consumes permitted knowledge.

**Trigger and inputs:** the manager selects an existing document and submits
replacement content. Preconditions are an existing document and current update
permission in the manager's scope.

| Step | Actor action | Observable system response |
| --- | --- | --- |
| S1 | Open the document and choose update. | Show the document and effective version being replaced. |
| S2 | Submit replacement content. | Check permission and input; accept or explain refusal. Acceptance is not effectiveness. |
| S3 | View progress, or leave and return. | Show processing and the same request's status; the old version remains effective. |
| S4 | No further routine action required. | When ready and still permitted, make the replacement effective without silently overwriting another update. |
| S5 | Inspect the result. | Identify the effective version and effective time; subsequent answers use it. |

Alternative and exception flows:

- **Invalid input, from S2:** explain the problem; allow correction and resubmission.
  Do not change the effective document.
- **Preparation failure, from S3:** show failure and a permitted next action;
  retain the usable effective version, never report success.
- **Permission lost before S4:** refuse activation of the replacement. A previous
  permission check is not permanent authority.
- **Concurrent update, at S4:** explain that another version is now effective;
  require the manager to review it before deciding a new replacement. No silent overwrite.
- **Repeated submission after response loss:** identify and report the original
  request rather than applying the same replacement multiple times.
- **Document removed during processing:** do not recreate it from late work.
- **Answer already using the old version:** preserve that answer's actual source;
  do not rewrite its history to pretend it used the replacement.

Success postconditions: the new version is effective and visible as such. Failure
postconditions: no unauthorized replacement, false success or loss of a still
valid effective version. A document legitimately removed by another action is
not required to remain available.

Business rules: current permission; no use of unready knowledge; no silent
overwrite; repeated requests do not multiply effects; no cross-customer disclosure;
answers identify the knowledge version actually used. Meaningful nonfunctional
requirements include understandable status/errors and scoped confidentiality.
Processing-time targets, allowed sizes and retention durations need explicit
product decisions, not invented numerical defaults.

Acceptance IDs below cover the main and exceptional outcomes. They are stable
example identities used by downstream checks, not executed proof.

## Architecture overview and SDS

**Proposal:** retain immutable content versions and a single effective-version
reference. Prepare a candidate without serving it; atomically activate only a
ready candidate whose authority and expected prior version still hold.

**Alternative challenged:** overwrite the current content in place. It uses less
temporary storage, but partial preparation can break serving and concurrent
updates can destroy a valid version. The versioned approach is chosen here with
explicit retention/cleanup cost, not as a universal pattern for every feature.

### Document lifecycle

| Logical owner | Responsibility and boundary |
| --- | --- |
| Document service | Requests, document/version metadata, effective-version transition and result. |
| Content store | Immutable version content; not update permission or activation decisions. |
| Preparation worker | Prepare candidates; cannot independently activate them. |
| Retrieval service | Serve only the permitted effective version and report actual sources. |
| Shared authority service | Current actor/scope permission; referenced rather than reimplemented. |

The authenticated update contract receives document identity, replacement content,
expected effective version and stable request identity. Actor/customer scope is
resolved from verified identity, not trusted client assertions. Repeating the
same identity/content returns the same request; different content under that
identity is rejected. Outcomes are accepted, denied, invalid or conflict, followed
by separately observable processing/effective/failed status.

Connections: the client invokes the document service synchronously; preparation
is asynchronous durable work; content and prepared data remain version-scoped.
No distributed atomic transaction across all stores is assumed.

Runtime path:

1. Verify permission, scope and expected prior version.
2. Store the candidate content without exposing it to retrieval.
3. Commit the request and durable preparation intent together in the metadata
   owner's consistency boundary. Orphaned unreferenced content may be collected
   only after checking that no live request/version owns it.
4. Prepare the candidate idempotently. A crash or duplicate worker delivery must
   not create extra effective transitions; retries remain tied to the request.
5. Recheck current authority, document existence and expected prior version.
   Serialize activation with conflicting changes. Integrate the shared authority
   contract's withdrawal/admission ordering; a loose earlier boolean check is
   not enough to settle a concurrent revocation.
6. Atomically change the effective reference and record the result. No old
   worker may overwrite a newer accepted transition.
7. Return or later retrieve the original result after response loss. Cleanup
   cannot remove effective content or content retained by in-progress readers.

If permission cannot be established, do not activate. If preparation/content is
incomplete, keep the candidate unserved and report the actual problem. A later
deletion prevents late work from resurrecting the document. A lost response after
activation is handled by reading the original result, not repeating the effect.

### Retrieval consistency, storage and recovery

An answer pins its effective document version at retrieval admission. Its sources
remain bound to that version; a new answer after activation selects the new
version. The read boundary must respect the committed effective reference rather
than rely on an indefinitely stale cache. Cache/index keys distinguish customer,
document and version; unactivated candidates cannot leak through search.

Original content, document metadata, request results and effective-version
identity are authoritative. Prepared search data may be rebuildable if the exact
content and preparation compatibility are retained. Enforce scoped credentials
and access at each data path, not merely in the editor. Document the actual
placement, connection and credential owners in the project's SDS, not source files.

Reference the shared backup design once. This module adds a restore invariant:
metadata claiming an effective version is insufficient when its content or
required prepared data is missing. Restore/check the consistent retained set,
hold unavailable documents honestly, then rebuild only supported derived data.
Do not infer a new authorized activation from restored pending work. Retention,
recovery targets and compatible preparation versions remain explicit decisions;
this document claims no HA deployment or recovery drill.

## UI design and actual product captures

The editor covers the list/effective version, replacement input, progress,
success, invalid content, preparation failure, conflict, lost permission and
return-after-navigation. Derive states and actions from SRS; use selected
knowledge and installed package Grammar, not invented look-alike components.

One direction may require many screens/states/viewports. Retained AI-generated
`interface.draw` images belong under UI assets and are labelled **design**.
Actual running-product reference screenshots also stay in `.starciwork`, labelled
**capture**, with the actual environment/build where known. Production baseline
images are not proof of the new implementation; local/staging images are not
production. Implementation captures and UAT videos have their respective owners.
Use references instead of copying the same binary to each layer.

Review coverage, actual images, keyboard/focus behavior, error recovery and
appropriate responsive layouts before accepting UI. No images exist in this
example, so neither visual review nor implemented UI is claimed.

## Backend implementation and backend E2E

The implementation record explains actual delivered behavior against the accepted
SRS/SDS, exact repository/revision, important design-to-code boundaries, checks
and remaining gaps. It does not duplicate the Git changed-file inventory or
copy source into Work. Candidate changes here remain proposed; there is no real
commit, tested source tree or accepted backend result for this example.

Distinguish these verification scopes:

| Scope | What executes | What it does not establish |
| --- | --- | --- |
| Unit | Isolated policy/transition/idempotency logic. | Real persistence, wiring or complete API flow. |
| Component integration | Actual selected storage/worker adapters and transactions. | Full application authentication and request-to-result path. |
| Backend E2E | Real application API/authentication/authorization, service wiring, durable request, actual worker, isolated real stores, activation and retrieval/status APIs. | Browser behavior or unexercised external providers. |
| Browser UAT | User operates the real FE against the identified backend/build. | All concurrency/crash properties merely from a happy-path video. |

Backend E2E must start at the application boundary and inspect actual persisted
results plus observable responses, not call a mocked service and name it E2E.
Use isolated disposable data and real relevant database/content/search services.
Drive the worker as the application would; use condition-based bounded waits.
Provider doubles, identity shortcuts or reduced bootstraps remain explicit scope
limits. They cannot prove a real boundary they bypass. Missing required complete
coverage blocks backend done even when all bounded tests pass.

| Criterion | Backend E2E action and expected result | Example actual |
| --- | --- | --- |
| AC-KNOW-SUCCESS | Submit through API; old version serves during preparation; new version serves after activation; stored result agrees. | not-run |
| AC-KNOW-INVALID | Submit invalid content; useful error and no effective-version mutation. | not-run |
| AC-KNOW-FAILURE | Fail preparation after acceptance; old valid content remains usable; status is failure, not success. | not-run |
| AC-KNOW-REVOKE | Revoke rights before the activation boundary; candidate never becomes effective. Exercise concurrent ordering, not only a preconfigured denied user. | not-run |
| AC-KNOW-CONFLICT | Release two requests against the same prior version concurrently; only the valid winner activates; loser reports conflict. | not-run |
| AC-KNOW-REPEAT | Repeat the same request and lose the first response; one activation and same result. Different payload under same identity is rejected. | not-run |
| AC-KNOW-RESTART | Interrupt preparation and restart its actual worker; safe continuation without extra activation. | not-run |
| AC-KNOW-REMOVE | Remove the document while preparation waits; late work cannot recreate it. | not-run |
| AC-KNOW-ISOLATION | Another customer attempts update/status/read; no private disclosure or mutation. | not-run |
| AC-KNOW-VERSION | Keep an old answer in progress while activating a replacement; old sources remain truthful, new retrieval uses the replacement. | not-run |

Retain useful raw results under the backend Work owner and link them through its
supported verification profile. State commands, actual outcome, tested subject,
scope and doubles. Dirty-tree runs need reproducible tested-change identity or a
rerun on the final revision; never silently label them as HEAD verification.
Backend handoff needs actual unit, backend E2E and API-contract results, not this
planned table. Failed, skipped, not-run and inconclusive are not passing criteria.

## Frontend implementation and browser UAT

Frontend implements the accepted editor states and real API contracts. Returning
to the page queries the original request. Late responses cannot replace a newly
selected document's state. Conflict and permission loss have real handling, not
only disabled buttons. Document actual API versus mock use and remaining gaps.
Capture the running FE under its Work assets; a drawing is not its implementation.

Browser UAT operates the identified build with disposable role-scoped users:
replace content, observe old/new serving, exercise invalid input and failure,
return after navigation/response loss, reproduce conflict, and verify denial.
Record expected versus actual for the same acceptance IDs, with useful screenshots
and playable video under the UAT owner. Record which harder concurrency/failure
properties are covered by backend E2E rather than pretending the video proves them.
The URL alone is not build identity. All browser outcomes here remain **not-run**.

## One full Plan; bounded workflow checkpoints

The Plan includes Business, Architecture, backend, frontend and terminal UAT
coverage. A separate UI deliverable can use design-interface; otherwise drawing
and review are part of the bounded frontend workflow. It is not a second Plan
that forgets the remaining outcome. Each workflow shows a short goal in chat
and links its full goal YAML before valid approval/delegated execution.

Example backend goal brief: "Implement document replacement under the accepted
SRS/SDS, prove real API-to-worker-to-storage-to-retrieval behavior, preserve old
content on failure, and report unit/E2E/API results. No FE, production or live
customer changes in this segment." This is presentation prose, not an approval.

Finish with actual results and usable outputs. Business/SDS review, UI review,
backend E2E and browser UAT are different completion obligations. No one result
may stand in for another; an unknown served build cannot accept a code revision.

## Repair example: old content disappears after failed replacement

- If SRS and SDS already require safe retention, repair implementation and recheck
  affected backend E2E/FE/UAT; do not rewrite expected outcomes to match the bug.
- If SRS is right but SDS permits premature deletion, repair the owning SDS first,
  then affected implementation and checks.
- If the intended failure outcome is missing from SRS, resolve that requirement
  within authority, repair design and follow the dependent graph.

Declared input hashes detect changed specifications, not absent graph edges or
truth of prose. Review exact dependencies and inspect effectiveState. Existing
done never locks authorized changes, but stale completion cannot be reused as
current proof. Unrelated completed branches remain intact.
