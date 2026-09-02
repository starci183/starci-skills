# A4 dry run 3 — `quality.verify` on the backend: precondition not met

Date: 2026-09-02. Attempted target: the starci-academy backend checkout at `0b540dd2`, delivery kind
`backend`, gates `format`, `lint`, `typecheck`, `build`, `unit-coverage`, `integration`, `e2e`
(not requested), `sonar` (`new-code`), using the repository's own commands (`npm run lint:check`,
`npm run typecheck`, `npm run build`, `npm run test:ci`, `npm run test:int`, `npm run sonar:check`).

## Why no artifacts exist

`input.schema.json` requires at least one entry in `context.predecessors` (`minItems: 1`), and every
predecessor must be a real receipt with a fingerprint and a source head. `quality.verify` verifies a
*delivery*; it refuses to run without the receipt of the producer that made it. No producer receipt
exists yet: the `business.decide` and `fe.presentation.resolve` dry runs both ended `blocked`, and
`backend.implement`, `fe.source.apply`, and `content.generate` have not run. Writing a predecessor
receipt by hand to unlock the gates would be a fabricated authority, so nothing was written.

This is the operator behaving as designed. The contract says what was built and why "arrive
decided"; a gate run without a delivery behind it would measure a checkout, not a delivery, and the
receipt would carry a `deliveryId` nobody owns.

## What was checked instead, read-only

| Item | Observed |
| --- | --- |
| Gate commands the plan would pin | all eight exist in `package.json` (`lint:check` runs eslint at `--max-warnings=0`; `test:ci` produces lcov and json-summary coverage; `test:int` carries `--passWithNoTests`, which the contract forbids for the unit gate and would need attention for `integration`) |
| Gate configurations | `eslint.config.mjs`, `tsconfig.json`, `tsconfig.build.json`, `jest.config.ts`, `nest-cli.json`, `sonar-project.properties`, `tsconfig.sonar.json` present; no prettier configuration, so a `format` gate has no pinned command here |
| Working tree | 75 dirty paths at the frozen head, so any run today would measure the working tree, not `0b540dd2` |
| Sonar scope | `sonar-project.properties` exists; the quality gate measures new code only, which the contract already names (`SONAR_NEW_CODE_ONLY`) |

## What unlocks the run

A `backend.implement` receipt on a committed head. The natural first candidate is the Pro
subscription work, once its three untracked directories are committed and `business.decide` publishes
the promise head from that commit.

## Open item for the tree

`test:int` uses `--passWithNoTests`. The contract forbids that flag for the unit gate ("a zero-test
run is not a pass") and says nothing explicit about `integration`. Either the integration gate adopts
the same rule, or the contract states why an integration run with zero tests may pass.
