# V3 skill foundation

Author contracts in this directory and build production JSON into `.dist/`.
[Schema](schema/README.md) owns `.works` records; [aliases](alias/README.md) own symbolic
bindings; [dependencies](dependencies/README.md) explain host setup on Windows, macOS and Linux.
Authored content is English.

## Operators

Each operator has `operator.json`, `request.json`, `response.json`, `validate.json`, `step.json`,
`criteria.json`, a README and local tests. The build produces one self-contained
`.dist/operators/<id>.json` with shared schemas and only the aliases that operator uses.

| Group | Operators |
| --- | --- |
| Planning and authority | [architecture.decide](operators/architecture.decide/README.md), [backend.plan](operators/backend.plan/README.md), [business.decide](operators/business.decide/README.md), [business.reconcile](operators/business.reconcile/README.md), [data.plan](operators/data.plan/README.md), [environment.preflight](operators/environment.preflight/README.md), [interface.plan](operators/interface.plan/README.md), [landing.compose](operators/landing.compose/README.md), [uat.plan](operators/uat.plan/README.md), [workspace.bind](operators/workspace.bind/README.md) |
| Design and implementation | [backend.generate](operators/backend.generate/README.md), [content.generate](operators/content.generate/README.md), [data.seed](operators/data.seed/README.md), [identity.provision](operators/identity.provision/README.md), [interface.draw](operators/interface.draw/README.md), [interface.fix](operators/interface.fix/README.md), [interface.generate](operators/interface.generate/README.md), [knowledge.repair](operators/knowledge.repair/README.md), [library.update](operators/library.update/README.md) |
| Verification and operation | [api.verify](operators/api.verify/README.md), [git.publish](operators/git.publish/README.md), [interface.audit](operators/interface.audit/README.md), [migration.release](operators/migration.release/README.md), [quality.verify](operators/quality.verify/README.md), [release.deploy](operators/release.deploy/README.md), [runtime.serve](operators/runtime.serve/README.md), [service.operate](operators/service.operate/README.md), [uat.verify](operators/uat.verify/README.md), [workflow.verify](operators/workflow.verify/README.md) |

## Agent feedback loop

Read the selected bundle and bind its workspace roots and capabilities from the invocation.
Validate the request, read its separate inputs and context, then execute the declared steps within
the existing authorization and write boundary. An alias declares a capability or resource; it does
not grant an external effect or expand the request.

Evaluate every machine check and operator review criterion against actual outputs. Record review
criterion IDs, results, referenced response output IDs and concrete notes in `criteriaResults`.
Record request `expected` coverage separately in `observations`. Machine results come from the
validator; reviews require actual evidence and judgment.

If a criterion fails, follow its `onFail` action and named `fromStep`, record concrete feedback,
repair only the cause and reassess dependent checks. `feedbackRound` starts at zero; increment it
once per repair round. The compiled limit prevents acceptance above the allowed round count and
turns further retry recommendations into stop. Keep truthful attempt history, stop repeated unchanged
failures, ask for missing essential input, and block unavailable capabilities. Observe uncertain
external effects before retrying; never blindly duplicate a commit, identity, seed, publish or deploy.

Return `done` only when all required reviews and request observations pass and current record/file
checks pass. Otherwise return `waiting`, `blocked` or `mismatch` with the actual reason. The validator
returns `accepted`, machine failures, review failures and targeted `feedback`; it does not invoke tools
or independently judge semantic correctness. A response marked done is not a completed work record.
If `work.json` exists, its identity and current revision must also match the request.

For visual work, inspect and pass the selected baseline as actual image context on every inherited
edit. Delete rejected generated images and previews after recording concise defects; preserve the
supplied baseline, submitted prompts and accepted images. Place accepted images beside their
response JSON with a Markdown preview.

## Build and test

```sh
python -m pip install -r tests/requirements-schema.txt
python scripts/build.py
python scripts/test_foundation.py
```

Builders require only the Python standard library. Validation and tests require the pinned
JSON Schema dependency. `python scripts/build.py --check` performs a read-only freshness check;
individual builders are `build-schema.py`, `build-alias.py` and `build-operators.py` under `scripts/`.
Generated bundles are tracked so a fresh checkout has the production files, and package installation
preserves them under `.claude/.dist/`. Do not edit generated files.

The foundation suite checks all operator packages and their local offline tests. It does not execute
production operations. [Three real interface.draw scenarios](operators/interface.draw/tests/scenarios/README.md)
record separate ImageGen runs against Nivo-derived briefs, including a rejected result and a successful
feedback repair. The existing orchestration engine retains its current contracts; consuming these
new bundles is explicit and does not migrate existing records automatically.
