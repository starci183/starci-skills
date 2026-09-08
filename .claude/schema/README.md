# Works schemas

This directory is the English-only, authored source for the proposed version 1 `.works` format.
The initial fields are concrete design defaults for review, not a claim that legacy sessions use
this format. Existing execution records and their gates are not migrated by this bundle.

## Source files

| File | Owns |
| --- | --- |
| `index.schema.json` | The closed union of accepted document kinds |
| `common.schema.json` | Shared identifiers, versions, timestamps, digests, paths, actors, scope and criteria |
| `work.schema.json` | Goal, scope, acceptance criteria and lifecycle |
| `request.schema.json` | Operation and expected results, with distinct inputs and context |
| `inputs.schema.json` | Prompts and files the skill acts on |
| `context.schema.json` | Supporting notes and reference files |
| `visual.schema.json` | New, extended or revised visual direction with explicit baseline and preserve/change intent |
| `image-generation.schema.json` | Retained request/attempt and baseline/prompt/image bindings |
| `response.schema.json` | Produced outputs, execution status and optional verification observations |
| `output.schema.json` | Typed text, commit, image and general file outputs |
| `evidence.schema.json` | Artifact location, digest and recorded provenance |
| `decision.schema.json` | Decision actor, source and exact subject binding |

Every record declares `schemaVersion: 1` and a distinct `kind`. Objects reject undeclared properties;
required fields cannot be omitted. Work revisions are positive integers. A completed work names
completion evidence; a done response contains at least one produced output. Mismatch, blocked and
waiting responses explain their reason. Producing a response does not prove the work's acceptance
criteria: observations are optional, and a delivered diagnostic can truthfully report a failed check.

[Requests and responses](request-response.md) defines the input/context/output separation.
Visual generation records are artifact payloads validated by the drawing operator; they do not add
a new top-level work-record kind to the entry union. `context.visual` is optional in the shared
request contract and required by `interface.draw`.

## Record layout

```text
.works/<work-id>/
  work.json
  requests/<request-id>.json
  responses/<response-id>.json
  evidence/<evidence-id>.json
  decisions/<decision-id>.json
  inputs/<input-file>
  context/<reference-file>
  artifacts/<artifact-file>
```

Input, context, output and evidence file paths are relative to that work directory. IDs are references, not embedded copies of other
records. The writer must check that the directory identity, referenced work revision, request,
criteria, evidence and decision subject agree. Artifact existence, actual hashes, complete criterion
coverage, unique criterion/output IDs, commit existence in the named repository, allowed state transitions and authenticated authority are semantic
checks outside JSON Schema. A well-shaped `approved` decision does not grant tool permissions.

## Build

From the package repository:

```sh
python scripts/build-schema.py
python scripts/build-schema.py --check
```

The default source is this `.claude/schema/` directory. The generated production artifact is
`.dist/schema.json`; package installation places it at the host's `.claude/.dist/schema.json`.
Only that single bundle ships for this contract. Source modules stay in this repository.
To write a bundle elsewhere, pass `--output <file>`. An explicit source directory uses
`--source <directory> --entry index.schema.json`. Output must stay outside the source directory.

The Python standard-library builder rewrites local references into `$defs`, retains sibling
constraints and recursive references, and replaces output only after successful linking. It rejects
duplicate JSON keys, module identities or root IDs, missing targets, escaping paths and unsupported
reference scopes. `--check` does not write. Anchors, nested IDs, dynamic references and remote fetches
are not supported. Values inside `const`, `default` and `examples` remain literal data.

## Validation and versioning

```sh
python -m pip install -r tests/requirements-schema.txt
python scripts/test_build_schema.py
python scripts/test_works_schema.py
```

Tests check the source schemas and production bundle, then exercise accepted and rejected records.
Runtime consumers must use Draft 2020-12 and enable date-time format checking. The test validator
configuration follows the [python-jsonschema validation documentation](https://python-jsonschema.readthedocs.io/en/stable/validate/).
The build script itself links schemas and does not replace instance or semantic validation.

`schemaVersion` identifies the document contract; `revision`/`workRevision` identify a work's scope
revision. They are different concepts. An incompatible contract change requires another schema
version and an explicit migration or reader strategy. Building a bundle never rewrites `.works`
records, upgrades their version or establishes their business correctness.
