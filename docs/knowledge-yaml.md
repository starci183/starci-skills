Owner: modules/schemas/knowledge-source.schema.yaml
# Authoring knowledge in YAML

Humans maintain structured knowledge under `knowledge/**/*.yaml`. Agents and operators read those YAML sources directly, so each rule has one copy. Do not create a parallel JSON copy of authored rules.

## Authority

| Layer | Location | Role |
| --- | --- | --- |
| Authored knowledge | `knowledge/**/*.yaml` | Edit topics here under `starci/knowledge-source@1`. |
| Current code references | `examples/index.yaml` and its indexed app sources | The `starci/code-example-catalog@1` metadata points to the actual source, compiler configs and tests; it does not duplicate code. |
| Calibration data | `knowledge/ui/proof/calibration/calibration.json` | Explicit data exception; all other authored JSON knowledge is rejected. |
| Runtime | `knowledge/**/*.yaml` | Read directly from source. Public names are the authored files: `index.yaml`, `foo.yaml`. |

Operator `supportingReferences` and `CONTEXT.md` name the current law in `docs/architecture.md` and `docs/code-pattern-enforcement.md`, pattern topics under `knowledge/patterns/*/index.yaml`, and `examples/index.yaml`. The single catalog reader resolves its indexed app inputs; declared READs retain their actual Source paths and hashes.

## Add a pattern topic

1. Choose the owning family directory (`knowledge/patterns/be/`, `knowledge/patterns/fe/`, or `knowledge/ui/...`).
2. Add `topic.yaml` with `schema: starci/knowledge-source@1`, stable `id`, `title`, `purpose`, `appliesTo`, and `rules[]` with stable rule IDs (`BE-…` / `FE-…`).
3. Register the topic in the family `index.yaml` `topics` list (`id`, `path`, `title`, `summary`, optional `ruleIds`).
4. Validate the YAML (see below). Do not invent a parallel JSON copy of the same rules.

## Add a code reference

1. Implement the pattern in an actual HFS app under `examples/`, with its real imports, owning
   configuration and tests.
2. Add one stable ID to `examples/index.yaml` under
   `modules/schemas/code-example-catalog.schema.yaml`, listing the complete app-relative source
   set, entrypoint, owning tsconfigs and tests.
3. Cite the ID from applicable pattern topics. The catalog reader rejects duplicate IDs,
   missing inputs and paths outside that app. Run the current canon and compiler over the
   listed source, then the applicable owning tests; catalog validity alone proves no conformance.
4. Regenerate derived Work or example evidence with its existing generator after the source
   freezes. Preserve deliberately invalid fixtures as negative oracles.

## Validation

From this skill directory:

```sh
starci check run --level L2
```

Authored knowledge is validated as YAML by the test suite and readers. Rejected: unsafe `..` paths, duplicate rule/example IDs, missing referenced example files, unsupported YAML tags/duplicate keys. Install/update copies the authored sources and records success after verification; see [releasing](releasing.md).

## Schemas

- `modules/schemas/knowledge-source.schema.yaml` (authored YAML)
- `modules/schemas/knowledge-rule.schema.yaml`
- `modules/schemas/code-example-catalog.schema.yaml`

## English only

Knowledge sources are English. Do not add translated `.vi` mirrors under `knowledge/`.
