# v8-5 lane report — `scripts/work-remap-path.mjs`

Mission (v6-4 FM3): one directory rename — `src/modules/bussiness`, a typo waiting to be fixed —
meant N hand-edits across four denormalized field shapes (`br.module`, `impl.owners[].path`,
`sds.owners[].path`, `fr.composes[].module`), every covering evidence digest stale, and unchecked
`composes[].module` left dangling. The tool makes the rewrite complete by construction.

## Interface

```
node scripts/work-remap-path.mjs [--tree <workRoot>] --from <oldPrefix> --to <newPrefix> [--apply] [--with-evidence]
```

- Default is DRY-RUN: every field that would change, grouped by record file, `trail: old -> new`.
- `--apply` rewrites in place; `--with-evidence` additionally marks affected `evidence.yaml`.
- No `--tree` = every `examples/*/.starciwork` tree (same default-tree discovery as
  check-work-deep.mjs). Exit non-zero on any REFUSE, 2 on usage errors.

## Design decisions

1. **Whole-scalar rule, not per-shape enumeration.** Every path-bearing shape stores the path AS
   the complete field value, so the rule is one test — a scalar `=== --from` or starting with
   `--from/` — which covers `owners[].path`, `module` (string or list), `composes[].module`,
   `surface.*`, `inputRefs`, `codeDigest.files[].path`, and any future path field for free.
2. **Comment-preserving splice.** `core/yaml.mjs`'s `parseYaml` runs `toJS()` — comments and layout
   are gone before a value is seen — so parse/edit/stringify would drop the provenance headers
   `evidence.yaml` carries (`# Written by scripts/example-evidence.mjs ...`). Apply instead splices
   each parsed value back into the raw text only where it is the WHOLE scalar: key colon / seq
   dash / flow delimiter / quote on the left, EOL / ` #` comment / flow delimiter on the right.
   `notes: moved to src/old` fails the left check (its scalar starts at `moved`); `path: src/x,`
   fails the right check outside flow.
3. **Embedded mentions are reported, never rewritten.** `assertions[].command`,
   `assertions[].observation`, `change.reason` and other prose can embed the old path; editing a
   captured command would falsify the evidence that recorded it.
4. **`--to` must already exist** under a bound root (the owning repo, any bound sibling repo, or
   the toolkit root for `.claude`-relative `inputRefs`-style values). The code moves first, the
   records follow — a `--to` that exists nowhere is a typo about to be written into every record.
5. **`--with-evidence` marks, never re-proves.** A record whose paths moved makes its evidence's
   `codeDigest`/`recordDigest` stale the moment the rewrite lands. The tool sets `stale: true` +
   `staleReason: "path remap <from> -> <to>"` (top-level scalar splice, so existing comments stay)
   and lets `example-evidence.mjs` re-prove. Already-stale files are left untouched. Affected =
   evidence whose own `files[].path` moved OR whose sibling record file moved.
6. **`_derived/` skipped** — generated output regenerates; it is never edited.
7. **Dedup per distinct old value.** Two fields can share one value (`module` and
   `composes[].module` both naming `src/old/x`); splicing per-field finds the same text occurrence
   twice and the edits overlap — caught on first real fixture run, fixed, regression-covered.

## Real findings on the live trees (dry-run only — fleet v7 owns these trees, `--apply` not run)

The honest invocation, `bussiness -> business`, REFUSEs on both real trees because the code has
not moved yet (exactly the guard the brief asked for):

```
REFUSE  examples/ecommerce-app-be/.starciwork: --to src/modules/business exists under none of
  examples/ecommerce-app-be, examples/ecommerce-app-fe, . - move the code first, then remap the records
```

To exercise the scanner on the real trees, `--to src/modules/integrations` (a dir that exists in
both) was used as the stand-in target. Summary counts:

- `examples/todo-app-backend/.starciwork`: **would change 1849 field(s); 74 evidence file(s) to
  mark stale; 289 embedded scalar(s) untouched; 8 prose/comment occurrence(s) untouched**
- `examples/ecommerce-app-be/.starciwork`: **would change 139 field(s) in 21 file(s); 8 evidence
  file(s) to mark stale; 5 embedded scalar(s) untouched**

Verbatim sample lines:

```
  features/task/fr/complete/index.yaml
    composes[0].module: src/modules/bussiness/task -> src/modules/integrations/task
    composes[1].module: src/modules/bussiness/task -> src/modules/integrations/task
    composes[2].module: src/modules/bussiness/share -> src/modules/integrations/share
  features/task/sds/ownership-guard/index.yaml
    owners[0].path: src/modules/bussiness/task -> src/modules/integrations/task
  features/identity/fr/sign-in/index.yaml                      (ecommerce tree)
    composes[0].module: src/modules/bussiness/session -> src/modules/integrations/session
```

All four FM3 shapes were hit on real data, plus `codeDigest.files[].path` (the dominant count)
and module lists (`module[0]`/`module[1]` on `br.sign-in`).

## Fixture `--apply` (per brief: never on real trees)

Copied `examples/todo-app-backend/{.starciwork,src}` to `D:\starci-tmp\v8-5-fixture\`, renamed
`src/modules/bussiness` -> `src/modules/business` there (the code move), then:

```
applied 1849 field(s) across 158 file(s); 73 evidence file(s) marked stale;
289 embedded scalar(s) untouched; 8 prose/comment occurrence(s) untouched
```

(74 stale targets; 1 was already `stale: true` and left as is.) Verbatim fixture diff:

```diff
-  - {rule: br.task.single-owner, module: src/modules/bussiness/task}
+  - {rule: br.task.single-owner, module: src/modules/business/task}
```

```diff
-    - path: src/modules/bussiness/task/complete-task.command.ts
+    - path: src/modules/business/task/complete-task.command.ts
  ...
+stale: true
+staleReason: "path remap src/modules/bussiness -> src/modules/business"
```

Evidence header comments survived verbatim (`# Written by scripts/example-evidence.mjs ...`).

**Gate verification:** `check-example-work.mjs` on the fixture gives identical verdicts before and
after the rewrite — `311 record(s), 2505 ref(s), 120 evidence file(s): 152 refused, 4 warned`
(all pre-existing RENDER_CHECK_FAILED palette findings; the remap added zero refusals because the
`stale: true` marks cover the digest mismatches and `src/modules/business` resolves on disk).
**Idempotent:** a second `--apply` rewrites 0 fields.

## False-positive rate observed

Zero. Every rewritten scalar was a whole-field path under `--from` (158-file diff audit: only path
tokens changed). The 289 embedded scalars + 8 comment/prose occurrences are *reported*, never
rewritten — e.g. `change.reason: "gap.audit.unbuilt-module is closed: AuditLogService.verifyChain
(src/modules/bussiness/audit ..."` correctly kept its historical text.

## Deliberately NOT done

- Does not move the code — records follow the rename; the `--to` existence check enforces that order.
- Does not rewrite embedded path mentions (commands, observations, prose, comments) — they are
  history, not references.
- Does not re-key `codeDigest` hashes — `stale: true` + re-prove is the honest path.
- Does not rename record ids (`br.x` -> `br.y`): `--to` must exist on disk and ids are not on disk.
- Folded scalars that cannot be located as whole text scalars are warned and left for hand edit
  (none observed on the real trees).

## Test

`tests/work-remap-path.spec.mjs` — 5 `node:test` specs on throwaway trees under `starci-tmp`
(same-drive fixture convention from `example-work-gate.spec.mjs`): field-shape coverage + embedded
reporting, whole-scalar splice preserving comments/quotes/prose, evidence stale-marking incl.
sibling-triggered marks and already-stale passthrough, and `--to` resolution/refusal.
`node --test tests/work-remap-path.spec.mjs` → 5 pass, 0 fail.
