# api.verify

Runs the repository-owned end-to-end API suite as an external client against the exact attested endpoint. It preserves raw output, every runner case, separate contract, data and lifecycle verdicts, API read-back evidence and exact namespace cleanup.

The operator never starts a server, writes product source, invents cases, derives a replacement endpoint or records credential values. The served head may contain other integration work, but it must contain the pinned commit. Every run that reaches case results is append-only; another attempt receives a new run identity.

`operator.json` defines identity and scope. `request.json` and `response.json` constrain the shared work envelopes. `step.json` binds, probes, runs, evaluates and records the work. `validate.json` separates executable record checks from evidence review. `criteria.json` turns failed checks into concrete feedback, targeted repair and reassessment with at most two feedback rounds.

A done response includes `api-verification`, `api-cases`, `api-verdicts` and `api-output`. Review checks prove the repository suite and attested head, three-lane integrity, namespace ownership and cleanup, append-only history and secret safety. Tests use synthetic local artifacts only and never contact an API.

Build and validate with `python scripts/build-operators.py`, `python scripts/validate_operator.py`, and `python .claude/operators/api.verify/tests/run.py`.
