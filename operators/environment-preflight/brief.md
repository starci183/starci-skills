# environment.preflight — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback.

## Done when

Done when the `readiness-report` carries an answer of ok, wall or skipped for every check of the closed vocabulary across every requested role and every operation class, no check answers wall, and the `environment-readiness` receipt names the declaration it read by path and hash.

Primary output: `environment-readiness`

## Inputs

none

## Outputs

`environment-readiness` `response/response.md`
`readiness-report` `response/data/readiness-report.json`

## Stops

`INVALID_INPUT`, `NO_PROGRESS`, `ROUTE_NAME_NEAR_MATCH`*, `ENVIRONMENT_NOT_READY`
