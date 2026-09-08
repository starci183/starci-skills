# interface.draw

Draw one interface direction as a PNG, inspect it against the brief, and present it with the
retained generation prompt and rationale. This operator produces design artifacts. Frontend
implementation and behavioral verification are separate tasks.

| Source | Responsibility |
| --- | --- |
| `operator.json` | Identity, purpose, scope and source module list |
| `request.json` | Shared request envelope constrained to this operation |
| `response.json` | Shared response envelope with required drawing outputs |
| `step.json` | Ordered work, explicit alias reads/writes/calls, checks and produced results |
| `validate.json` | Executable machine checks and separate visual review instructions |
| `criteria.json` | Required output criteria, targeted feedback, retry bounds and stopping conditions |
| `tests/` | Contract tests and independent request, response and recovery cases |

The operator uses the request's existing `inputs`, `context` and `expected` fields. It adds no
second request envelope. A completed response supplies `direction` (PNG), `generation-prompt`
(plain-text file), `generation-context` (JSON file) and `rationale` (inline text), each as a typed output. Non-done responses explain
the condition and may retain partial results. The response schema remains closed through its
shared contract reference.

## Visual inheritance

`context.visual` is required for this operator:

```json
{
  "mode": "extend",
  "baselinePath": "context/current-dashboard.png",
  "preserve": ["Keep the application shell, navigation, palette and typography."],
  "change": ["Add the requested feature within its declared region."]
}
```

`baselinePath` must match exactly one image entry in `context.files`, whose digest binds the actual
file. `extend` adds to the selected design; `revise` changes it; `new` is a new direction with no
baseline. Select the current or chosen image for the relevant surface, not the latest unreviewed
candidate. When an existing design should be inherited but its image is missing, recover the image
or ask for the missing input instead of silently using `new`.

The ImageGen call must receive the actual baseline image, with explicit preserve/change instructions.
A retained extend/revise prompt must include every preserve/change item verbatim as a checklist;
the validator checks literal retention, not the meaning of arbitrary prose or the provider's compliance.
A filename in prompt text and presumed conversation memory are insufficient. `generation-context`
records request/attempt identity, mode, baseline, final prompt and resulting image bindings. The
validator checks their hashes and relationships. It cannot prove that a provider actually consumed
the reference or that the result visually preserves it; inspect baseline and result together.
Every retry keeps the selected baseline and exact prompt. Delete rejected generated images and their adjacent previews after recording concrete defects; keep accepted outputs.

Steps declare workspace reads and writes separately from capability calls. `@tools/imagegen`
generates the image; `@tools/imageview` inspects actual pixels; `@tools/print` presents it.
`@cli/python` runs machine validation. Optional frontend, grammar and knowledge references are
read only when explicitly bound. `interface.draw` is a declared writer only for artifacts and
response records. The alias declaration still does not override the request scope or host permissions.

## Build

```sh
python scripts/build.py
python scripts/build.py --check
python scripts/build-operators.py
```

The operator builds to `.dist/operators/interface.draw.json`. That one file includes request and
response schemas, their shared definitions, used alias bindings, steps, validation and criteria.
Tests and this source guide are excluded. Builds read current schema and alias sources directly;
they do not depend on stale sibling bundles. Update all bundles together before packaging.

## Validate records

Install development validator dependencies from `tests/requirements-schema.txt`, then run:

```sh
python scripts/validate_operator.py --operator .dist/operators/interface.draw.json --request <request-file> --work-root <work-directory>
python scripts/validate_operator.py --operator .dist/operators/interface.draw.json --request <request-file> --response <response-file> --work-root <work-directory>
python .claude/operators/interface.draw/tests/run.py
```

Machine checks verify record shapes, request/work binding, unique criterion/output IDs, declared files,
SHA-256 digests, output scope, text encoding, generation context and observation references. PNG checks
cover structure, CRCs, compressed image data and scanline filters, with 64 MiB compressed/chunk and
256 MiB decoded-data validation limits. They do not establish that the picture is a useful interface.
Visual fidelity, image-generation provenance and actual presentation remain observed review;
`machinePassed` never means the design was accepted. A synthetic test PNG is not a design result.

`criteria.json` drives the invoking agent's feedback loop: produce, evaluate, record concrete
failures, repair from the named step, then reassess. `feedbackRound` starts at zero and increases
once per repair round, up to `limits.feedbackRounds`. An unchanged repeated defect is a stop;
missing essential context asks, unavailable capabilities block, and uncertain external execution
must be observed before another call. The validator returns targeted `feedback` instructions and
an `accepted` flag. It never calls tools or rewrites a response on its own.

A done response must include a passed `criteriaResults` entry for every operator review criterion,
with actual response `outputIds` and a concrete note. Its `observations` must cover every request
`expected` id exactly once and pass. Machine outcomes are computed from records and bytes, not
self-reported as review results. A missing review, stale binding, unknown output reference, failed
criterion, or exceeded round limit prevents acceptance. These checks establish record consistency;
the agent still owns honest pixel inspection, call provenance and a truthful retry history.

Keep concise rejected-candidate diagnostics and submitted prompts. Do not retain or present failed
images as deliverables. Put the accepted PNG and a Markdown preview beside its response JSON.
Tests include synthetic boundary cases and three separately documented real ImageGen scenarios.
The latter used the historical operator snapshot under `tests/scenarios/operator-under-test.json`;
their reports state the observed outcomes and subsequent rejected-image cleanup.
