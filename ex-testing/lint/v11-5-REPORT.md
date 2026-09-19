# v11-5 — update checks for the compact format (LAST)

Scope: `scripts/check-*.mjs`, `scripts/example-*.mjs`. Reads `v11/_common.md` (wait gate) + this lane's brief.

## Wait gate

Required markers: `v10-1..5`, `v9-2..10`, `v11-1..4` (60min budget from lane start, poll ~3min).
Present when the script work was done: `v10-1, v10-2, v10-3, v10-4` and `v9-1..6, v9-8, v9-9`.
Absent at decision time: `v10-5`, `v9-10`, `v11-1, v11-2, v11-3, v11-4` (tree still carries 34 `ac/` dirs).
The lane's deliverables are written so they hold whether or not the compaction lanes land afterwards:
the compact rules are additive and inert on an uncompacted tree (proved by fixture tests and by
identical before/verify counts below), and the final battery in `v11-FINAL-STATUS.md` records counts
against whatever tree state exists at that moment.

## Shared resolution layer — `scripts/example-ownership.mjs`

One place every script asks "what record does this ref mean", so the checks cannot drift:

- `INLINE_CRITERION_FIELDS = ['acceptance', 'statements']` — the fields a parent may carry inlined
  criteria under, per the v11 collapse law.
- `inlineCriteriaOf(data)` — the inline criterion entries one record carries (`{id, name, entry}`);
  plain-string list items (a BR's prose `statements`) are not criteria.
- `indexInlineCriteria(records)` — `byAcId` (declared `ac.*` entry id -> carrying record id),
  `byParent` (parent id -> fragment -> entry, keyed by full id, `name`, and last id segment), and
  `collisions` (one `ac.*` id claimed under two parents).
- `splitRef(ref)` — `P#frag` -> `{id: P, frag}`; plain -> `{id, frag: null}`.
- `resolveRecordRef(records, ref, inline?)` — the canonical record id a reference resolves to:
  live id -> itself; `P#frag` -> P when P is a record and frag names an inline criterion P carries
  (or a live record id, covering kept-separate criteria); a bare collapsed `ac.*` id -> the parent
  record now carrying it; otherwise null.
- `resolveOwnedDirs` canonicalizes `proves` entries before the prover-fallback compare, so
  `proves: [br.x#crit]` still anchors the spec's codeDigest to that implementation's owners.

## Per-script changes

### `check-example-work.mjs` (the gate)

- Inline-criterion block: `AC_ID_MISMATCH` (an entry's declared `id` must be `ac.<parent tail>.*`,
  the same place-law a file under `ac/` lived under), `AC_ID_COLLISION` (inline id that is also a
  live record's id, or claimed under two parents), `AC_LIFECYCLE_INLINE` (an entry carrying `state`,
  `change`, `evidence` or `provenBy` — a criterion with its own lifecycle stays its own `ac/` record).
- Ref resolution: `parent#frag` resolves (full ac id, short name, last segment); a bare collapsed
  `ac.*` ref still resolves through the parent but warns `AC_UNREMAPPED_REF` pointing at the
  canonical `parent#ac-id` form — except on the entry's own `acceptance.id`/`statements.id`
  declaration trail, which never warns. `something#` / bad fragments refuse `REF_MALFORMED`
  rather than passing silently as strings.
- Every structured ref field resolves through `resolveRecordRef`: `blockedBy[].record`,
  `conflictsWith[].record`, `tension.records`, `closedBy`, `appliesTo`, event `producer`,
  `subscribes`, `data.extends`, `proves`, uat `environment`/`fixtures`/`accounts` identities, the
  IMPL_BEFORE_DIRECTION ui list, and the blocker-DAG walk — a `P#frag` there means the parent record.
- Robustness: a YAML the runtime loader rejects is refused in place (never crashes the whole gate —
  observed mid-write during concurrent lanes); non-`work/` schemas are counted `PAYLOAD_SKIPPED`
  INFO and never id-matched or ref-collected (both from concurrent v10 lanes, kept).

### `check-work-deep.mjs`

- `depsOf` sees `P#frag` as a dep on P and canonicalizes collapsed `ac.*` deps to the carrying
  record, so `DEP_STALE` follows a dependency through the collapse instead of losing it; baseline
  dep ids from before the collapse resolve through the same map.
- `PROVENBY_AUTHORED` still refuses hand-authored `provenBy` (absence is not flagged anywhere);
  its target check and `EVENT_PRODUCER_IS_RULE` resolve canonical ids.
- Unguarded `parseYaml` on `evidence.yaml` wrapped (same crash vector the gate had).

### `check-work-consistency.mjs`

- Concept 1 (`AC_NAMING_ASYMMETRY`) is dual-format: `acceptanceCriteria` names resolve against
  `ac/` dirs, live records, or inline `acceptance:`/`statements:` entries; the reverse direction
  refuses an inline entry the rule's `acceptanceCriteria` does not name (when that list or `ac/`
  exists); a kept-separate ac record is reachable via `acceptanceCriteria` OR a pointer entry's
  `ref`/`id`/`name`, and must still live under the rule's `ac/` directory.
- `proversOf` reverse index, `PROVES_ASYMMETRY`, journey `requirements` route steps,
  `conflictsWith` pairs, and gap `closedBy` all compare canonical ids.

### `check-work-surfaces.mjs`

- `provedIds` (impl `proves`), `subscribesByFeature`, `CONTRACT_EVENT_GHOST`, and
  `SUBSCRIPTION_NOT_WIRED` all canonicalize refs before comparing.

### `check-work-artifacts.mjs`

- `record:` fields inside manifests/receipts (`named-record` base) resolve canonical ids, so a
  declaration anchoring to `parent#frag` or a collapsed `ac.*` id lands on the carrying record's dir.

### `check-work-replay.mjs`

- `collectAssertions` joins `evidence.record` to the carrying record through `resolveRecordRef`,
  so evidence still names a collapsed criterion's old id or `parent#frag` form.

### `example-derive.mjs`

- `collectIdsByTrail` collects the record half of `P#frag`; `buildUsedBy` drops inline criteria's
  own `acceptance.id`/`statements.id` declarations (not edges) and canonicalizes collapsed `ac.*`
  targets, so the derived `usedBy` index keys on records that exist.
- `unmetBlockers`, `resolveBlockers`, `effectiveStateOf` and the frontier filter take a shared
  `canon` so blocker graphs walk through compact refs.

### `example-critique.mjs`

- `buildProvesUsedBy`, blocker-cycle `edgesOf`, ring edge lookup, and `done-proves-not-done`
  canonicalize — blast radius and cycle findings stay correct under compact refs.

### `example-evidence.mjs` / `example-verify.mjs`

- `--record` resolves `P#frag` and collapsed `ac.*` ids to the carrying record: evidence is written
  beside that record and `record:` names its own id (the gate's sibling rule requires it).

### `check-example-derived.mjs`

- Forbidden authored fields extended to `provenBy` and `derived` — provenance is computed from done
  records' `proves` edges and `derived:` is a comment pointer, never authored fields.

### Unchanged (verified format-safe)

- `check-work-history.mjs` — iterates live record files only; collapsed `ac/` files simply leave
  the inspected set (records.count output is dynamic).
- `check-example-yaml.mjs` — pure runtime-loader acceptance over every yaml, format-agnostic.
- `FAMILIES` still includes `ac` — kept-separate criteria remain legal records.

## Tests

`tests/example-work-gate.spec.mjs` gained five compact-format tests covering: `parent#frag`
resolution by short name / last segment / full ac id, dangling fragment, missing parent, malformed
`P#`, bare collapsed `ac.*` resolution + `AC_UNREMAPPED_REF` warning (and the declaration-trail
exemption), `AC_ID_MISMATCH`, `AC_ID_COLLISION` (live record + dual parent), `AC_LIFECYCLE_INLINE`,
structured-field resolution (`blockedBy`, `closedBy`), and kept-separate ac records. 29/29 pass;
all 122 tests across the touched specs (`work-consistency`, `example-derive`, `example-evidence`,
`example-verify`, `work-replay`, `work-surfaces`, `work-artifacts`, `work-history-check`,
`example-critique`) pass.

## Counts

See `v11-FINAL-STATUS.md` for the before/after matrix across every check on both trees.
Raw runs: `ex-testing/lint/v11-5-runs/<check>.before.txt` (pre-compaction, updated scripts).
