# content.generate — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback. Context is limited to what request.json names.

## Done when

Done when the `content-brief` was frozen before any edition, every declared language has an `article` covering the whole published outcome set, every declared `track` was built and checked by its declared command with a zero exit code recorded in `e2e`, an `image` exists only when its stage was on and then with its `image-prompt` beside it, and an independent `content-review` written without the producer's rationale approves the unit with every applicable score at or above the published minimum and no open error finding, as the `content-generation-receipt` states.

Primary output: `content-generation-receipt`

## Inputs

`content-generation-receipt`?

## Outputs

`content-generation-receipt` `response/response.md`
`content-brief` `response/brief.md`
`e2e` `response/data/e2e.json`?
`content-review` `review/response/review.md`
`article` `response/artifacts/article.<language>.md`
`image` `response/artifacts/image.<name>`?
`image-prompt` `response/artifacts/prompt.<name>.txt`?
`track` `response/artifacts/track.<language>.<extension>`?

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `BRIEF_UNBOUND`, `OUTCOME_UNCOVERED`, `IMAGE_UNAVAILABLE`, `CODE_BUILD_FAILED`, `E2E_FAILED`, `CONTRACT_WEAKENED`, `REVIEW_REVISION_REQUIRED`*, `REVIEW_ROUNDS_EXHAUSTED`
