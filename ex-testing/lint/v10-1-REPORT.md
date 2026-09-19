# v10-1 — gate fix: skip non-work payload yaml

## What changed

- `scripts/example-ownership.mjs`: new shared `isWorkRecordSchema(schema, workspaceDoc)` —
  the `schema:` marker is the discriminator. `work/` is the record namespace; a
  `workspace.yaml` may widen it via `recordSchemaPrefixes` (none do today). Anything else
  (`starci/generation-receipts@1`, `starci/direction-check@1`, `starci/uat-run-manifest@1`)
  is a tool's artifact payload, not a record. Absent/non-string schema stays on the record
  path, so a deleted marker cannot hide a malformed record. Applied inside `loadRecords`
  (the shared loader used by consistency/deep/history/replay/surfaces/artifacts), so every
  consumer now gets the same answer to "is this file a record".
- `scripts/check-example-work.mjs`: the walker reads `schema:` before any record treatment;
  foreign-schema yaml is counted INFO `[PAYLOAD_SKIPPED]` and walked past — never id-matched
  to its path, never ref-collected, never added to `records`. `checkWorkTree` gained an
  optional `infos` channel and returns `payloads`; the CLI prints `INFO` lines and the count.
  EXEMPT dropped the three non-`work/` entries (`starci/application-stacks`,
  `starci/generation-receipts@1`, `starci/direction-check@1`) — the prefix rule subsumes them;
  the five `work/*` exemptions stay (they are real records in non-family positions).
- `tests/example-work-gate.spec.mjs`: new fixture test — receipt under a family path produces
  zero refusals + PAYLOAD_SKIPPED info; manifest internals carrying record-shaped ids are not
  collected (a `br.f.ghost` inside a manifest cannot refuse, while the same id on a real
  record still does); a schema-less yaml still gets the id-check.

## Before / after

Baseline note: the 6 payload refusals were already suppressed in the working tree by an
uncommitted stopgap that whitelisted the two receipt schemas into `EXEMPT`. This lane replaces
that with the schema-prefix discriminator, so the coverage is principled (run manifests and any
future `starci/*` tool file are handled the same way).

Same live tree, both code paths (`git show HEAD:` copies run side by side):

| check | old code | new code |
|---|---|---|
| `check-example-work` | 9 refused, 0 payload info | 6 refused, 38 `PAYLOAD_SKIPPED` info |
| of which payload misreads | 6 (`id is undefined` on assets/*.yaml) | 0 |

The old-code run reproduces exactly the 6 refusals the brief names. The remaining refusals on
the new-code run are `recordDigest`/`CODE_DIGEST_STALE` on records v10-2 was mid-edit on at
measurement time (owners expansion at rev 3, `at: 2026-09-19T17:00:00Z`), plus v10-3's new
`contract.identity.internal.sessions` awaiting its own evidence — in-flight lane state, not an
effect of this change. Structurally the skip can only remove payload-caused refusals: payload
internals were collected refs but never ref *targets* (run ids contain uppercase segments and
cannot match `ID_RE`), and no record rule consumed payload entries.

Downstream gates via shared `loadRecords` (same-run before/after; trees are being written by
other lanes so suspect deltas are lane churn, all verified non-payload):

| check | before | after | delta |
|---|---|---|---|
| consistency | 335 rec, 7 refused, 25 suspect | 310 rec, 7 refused, 24 suspect | refused unchanged |
| deep | 1 refused, 13 suspect | 1 refused, 3 suspect | -10 = v10-2/v10-3 owner/spec fixes landing |
| surfaces | 2 refused, 16 suspect | 2 refused, 10 suspect | refused unchanged |
| artifacts | 337 rec, 34 refused, 58 suspect | 310 rec, 36 refused, 58 suspect | +2 ASSET_DIGEST from lanes adding assets |
| history | 337 rec, 42 refused, 53 suspect | 310 rec, 42 refused, 53 suspect | identical |

Fixture spec: 24/24 pass.

## Notes for the fleet

- `example-derive.mjs`'s private `readTree` still indexes payload manifests as records
  (`state: null` entries in `_derived/index.yaml`). Harmless to the gate — those ids are map
  keys / non-ID_RE values, never collected — but v10-5's `_derived` rebuild may want the same
  `isWorkRecordSchema` predicate for a truthful index.
- Concurrent lanes write yaml non-atomically on this host: whole-gate runs crashed twice on
  torn writes (`parseYaml` throws uncaught in the walk). Not introduced by this change; a
  gate-level try/catch or retry is a candidate follow-up if flakes bother v10-5.
- `check-work-deep`'s `PAYLOAD_AS_RECORD` info ("the base gate should not walk them as such")
  now describes a solved state — its file-walk detection is unchanged and still correct.

Raw captures: `ex-testing/lint/_v101-gate-after.txt`, `_v101-gate-oldcode-sametree.txt`,
`_v101-{deep,history,surfaces,artifacts}-{before,after}.txt`, `_v101-consistency-after.txt`
(consistency baseline `335 rec / 7 refused / 25 suspect / 10 info` was observed on stdout).
