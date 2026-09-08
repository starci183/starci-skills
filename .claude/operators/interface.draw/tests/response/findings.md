# Response-test findings

Scope: offline `interface.draw` response, artifact, identity, and provenance behavior. Every image and prompt byte created by `test_response.py` is explicitly synthetic; no ImageGen call, live service, credential, or Nivo checkout mutation is involved.

Narrow Nivo basis:

- `nivo-fe/apps/app/src/components/blocks/academy/AcademyGrowthSummary/component.tsx` (`sha256:b8f6b1bc67ae9d9f083e74a934d8f6ea1b2591ff0236944da4c25883476f7dc7`) renders revenue, paid orders, members, completions, and `activeMembers / totalMembers`, with `resting`, `refused`, and `answered` states.
- `nivo-fe/apps/app/src/modules/api/console.ts` (`sha256:4d077547639e37f408a2b567ae225cc01132cf382128eab185123097aeaa487c`) requests exactly `revenueVnd`, `paidOrders`, `totalMembers`, `activeMembers`, and `totalCompletions` for `myAcademyGrowthSnapshot`.
- `nivo-backend/src/features/core/api/core/graphql/queries/academy-control-center/my-academy-growth-snapshot/graphql-types/response.ts` (`sha256:53c4c38868fa3b5f006f2ce30e0984c357550f113d4a4a34837221a9a3e99f5d`) exposes the same five integer fields.
- `nivo-backend/src/features/core/api/core/graphql/queries/academy-control-center/my-academy-growth-snapshot/my-academy-growth-snapshot.service.ts` (`sha256:e678a6d4e4c2d0a99a35c28150b1377de10c24413f0e3006e07ab05264aa1430`) resolves an owned site before querying the runtime snapshot. Tests therefore treat invented conversion/trend metrics and unqualified cross-site data as unsupported claims.

Expected behavior established from the operator source:

- A response is bound to the exact request and work revision. A correction keeps that binding, gets a new response id, names the prior response in rationale, and writes a new attempt.
- `direction.png`, `generation-prompt.txt`, and `generation-context.json` are one generation attempt. The context record binds the exact visual baseline, prompt, result, request, mode, and attempt. Their hashes establish retained bytes, while image inspection and provenance review establish what those bytes mean.
- A `done` response cannot simultaneously record a failed acceptance criterion. Observation criterion ids and evidence ids must resolve to the current request and response.
- A PNG artifact must be decodable, not merely begin with a plausible 24-byte header. A `text/plain` prompt must contain text.

The adversarial cases verify the following machine-enforced failures:

1. A truncated 24-byte pseudo-PNG is rejected after structural chunk, CRC, compressed-stream, and scanline validation.
2. Invalid UTF-8 binary bytes declared as a `text/plain` prompt are rejected even when the supplied hash matches.
3. A prompt/image/context trio split across attempt directories is rejected, as is a generation context bound to a different declared baseline.
4. `done` plus a failed observation is rejected. Unknown criteria, missing evidence records, and evidence from a stale work revision are also rejected.

Passing cases also pin the intended boundary: valid synthetic metadata still returns all five manual reviews, stale request/revision bindings fail, a properly identified correction passes, and `mismatch` can retain partial outputs with a concrete reason. A correctly hashed evidence record can still contain a semantically irrelevant note, so machine success deliberately does not erase `brief-fidelity` or the other visual reviews.

Verification on 2026-09-08 used the supplied local `jsonschema` dependency directory through `PYTHONPATH` (the test source contains no dependency-path assumption):

- `python .claude/operators/interface.draw/tests/run.py --case response` — 12 tests passed.
- `python .claude/operators/interface.draw/tests/run.py` — 48 tests passed across contract, recovery, request, and response cases.

Limit: these tests prove record shape, byte integrity, identity binding, and retained provenance metadata. They do not prove that an image visibly matches the Nivo surface, that evidence is semantically relevant, or that a model actually used the bound baseline; the five returned manual reviews remain necessary.
