# Authoring knowledge in YAML

Humans maintain structured knowledge under `knowledge/**/*.yaml`. Agents and operators consume generated JSON under `.dist/knowledge/**/*.json`. Do not hand-edit `.dist`.

## Authority

| Layer | Location | Role |
| --- | --- | --- |
| Authored source | `knowledge/**/*.yaml` (and multi-file example `.ts`/`.tsx`) | Edit here. Schema `starci/knowledge-source@1` for topics; `starci/code-example@1` for example manifests; catalogs may use `starci/code-examples-catalog@1`. |
| Calibration data | `knowledge/ui/proof/calibration/calibration.json` | Explicit data exception; all other authored JSON knowledge is rejected. |
| Runtime | `.dist/knowledge/**/*.json` | Generated. Stable public names: `index.yaml` → `INDEX.json`, `foo.yaml` → `foo.json`. |

Operator `supportingReferences` and `SKILL.md` keep stable runtime paths such as `knowledge/coding-reference.json` and `knowledge/patterns/*/INDEX.json`. Those names remain the public contract; the build copies or projects them into `.dist`. Prefer reading the same stem from `.dist/knowledge/` after a fresh build when verifying packaging.

## Add a pattern topic

1. Choose the owning family directory (`knowledge/patterns/be/`, `knowledge/patterns/fe/`, or `knowledge/ui/...`).
2. Add `topic.yaml` with `schema: starci/knowledge-source@1`, stable `id`, `title`, `purpose`, `appliesTo`, and `rules[]` with stable rule IDs (`BE-…` / `FE-…`).
3. Register the topic in the family `index.yaml` `topics` list (`id`, `path`, `title`, `summary`, optional `ruleIds`).
4. Compile and check (see below). Do not invent a parallel JSON copy of the same rules.

## Add a code example

1. Create `knowledge/code-examples/<lane>/<example-id>/` with real `.ts`/`.tsx` files (and specs when they teach verification).
2. Add `index.yaml` with `schema: starci/code-example@1`: purpose, `relatedRules`, `files[]` roles, `entrypoint`, `adapt`, dependencies, honest `verification` flags, and provenance.
3. List the example in `knowledge/code-examples/<lane>/index.yaml` and the top-level `knowledge/code-examples/index.yaml` catalog.
4. Compile. The runtime JSON under `.dist/knowledge/code-examples/...` bundles file text for agents; it never executes example code at compile time.

## Build commands

From this skill directory:

```sh
node scripts/compile-knowledge.mjs          # write/check projected knowledge into the compile Map / `.dist/knowledge`
node scripts/compile-knowledge.mjs --check  # read-only stale/missing detection
npm run build                               # generate ops + build; compilation errors stop the build
node scripts/ensure-build.mjs               # required knowledge compile + generate + build
npm test
```

The compiler is required. Invalid knowledge stops build and ensure-build; there is no JSON fallback or deferred success. Generated JSON uses one line per file. `.dist` is ignored by Git and excluded from the package payload. Install/update builds it from the installed source, runs a check, and records success only after that verification succeeds. Interrupted install recovery and the full source-built distribution contract are in [runtime distribution](runtime-distribution.md).

## Schemas

- `schemas/knowledge-source.schema.json`
- `schemas/knowledge-rule.schema.json`
- `schemas/code-example-manifest.schema.json`

Validate through the compiler. Rejected: unsafe `..` paths, duplicate rule/example IDs, missing referenced example files, unsupported YAML tags/duplicate keys.

## English only

Knowledge sources and generated runtime documents are English. Do not add translated `.vi` mirrors under `knowledge/`.
