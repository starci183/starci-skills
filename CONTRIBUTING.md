# Contributing

## Development setup

Requires Node.js 20 or newer and Python 3.11 or newer.

```bash
npm ci
npm test
```

## Change rules

- Keep every user-facing skill under `skills/starci-*`.
- Start each skill machine at `analyze-input` and route every declared input mode exactly once.
- Keep operators atomic and business-neutral unless they are in the `business/` domain.
- Give every skill and operator closed Draft 2020-12 input/output schemas and fail-closed validators.
- Declare knowledge in `operator.json`; do not embed a second copy in a skill.
- Regenerate deterministic artifacts with `npm run materialize`, then review the diff.
- Add or update route tests for every state transition change.

Generated files are committed so consumers do not need the materializer at runtime.
