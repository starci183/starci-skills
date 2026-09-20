# Authoring knowledge in YAML

Humans maintain structured knowledge under `knowledge/**/*.yaml`. Agents and operators consume the same YAML sources directly; there is no compiled knowledge bundle. Do not create a parallel JSON copy of authored rules.

## Authority

| Layer | Location | Role |
| --- | --- | --- |
| Authored source | `knowledge/**/*.yaml` (and multi-file example `.ts`/`.tsx`) | Edit here. Schema `starci/knowledge-source@1` for topics; `starci/code-example@1` for example manifests; catalogs may use `starci/code-examples-catalog@1`. |
| Calibration data | `knowledge/ui/proof/calibration/calibration.json` | Explicit data exception; all other authored JSON knowledge is rejected. |
| Runtime | `knowledge/**/*.yaml` | Read directly from source. Public names are the authored files: `index.yaml`, `foo.yaml`. |

Operator `supportingReferences` and `SKILL.md` name runtime paths such as `knowledge/coding-reference.yaml` and `knowledge/patterns/*/index.yaml`. Those authored paths are the public contract; consumers read them in place.

## Add a pattern topic

1. Choose the owning family directory (`knowledge/patterns/be/`, `knowledge/patterns/fe/`, or `knowledge/ui/...`).
2. Add `topic.yaml` with `schema: starci/knowledge-source@1`, stable `id`, `title`, `purpose`, `appliesTo`, and `rules[]` with stable rule IDs (`BE-…` / `FE-…`).
3. Register the topic in the family `index.yaml` `topics` list (`id`, `path`, `title`, `summary`, optional `ruleIds`).
4. Validate the YAML (see below). Do not invent a parallel JSON copy of the same rules.

## Add a code example

1. Create `knowledge/code-examples/<lane>/<example-id>/` with real `.ts`/`.tsx` files (and specs when they teach verification).
2. Add `index.yaml` with `schema: starci/code-example@1`: purpose, `relatedRules`, `files[]` roles, `entrypoint`, `adapt`, dependencies, honest `verification` flags, and provenance.
3. List the example in `knowledge/code-examples/<lane>/index.yaml` and the top-level `knowledge/code-examples/index.yaml` catalog.
4. Agents read the example files in place; nothing executes example code at read time.

## Validation

From this skill directory:

```sh
npm test
```

Authored knowledge is validated as YAML by the test suite and readers. Rejected: unsafe `..` paths, duplicate rule/example IDs, missing referenced example files, unsupported YAML tags/duplicate keys. The retired knowledge compiler lives under `legacy/builders/` for historical reference only. Install/update copies the authored sources and records success after verification; see [runtime distribution](runtime-distribution.md).

## Schemas

- `schemas/knowledge-source.schema.yaml` (authored YAML; the retired JSON mirror is historical)
- `schemas/knowledge-rule.schema.yaml`
- `schemas/code-example-manifest.schema.yaml`

## English only

Knowledge sources are English. Do not add translated `.vi` mirrors under `knowledge/`.
