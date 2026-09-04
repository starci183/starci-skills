# content.generate — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop. You see only what request.json names; nothing else exists.

## Job

Generate or refactor one educational content unit in one linear pass: a teacher brief that constrains everything after it, one written edition per declared language, images made to a stated claim, code and executable checks that actually run, and an independent review that receives the artifacts without the producer's rationale.

## Done when

Done when the `content-brief` was frozen before any edition, every declared language has an `article` covering the whole published outcome set, every declared `track` was built and checked by its declared command with a zero exit code recorded in `e2e`, an `image` exists only when its stage was on and then with its `image-prompt` beside it, and an independent `content-review` written without the producer's rationale approves the unit with every applicable score at or above the published minimum and no open error finding, as the `content-generation-receipt` states.

Primary output: `content-generation-receipt`

## Inputs

`content-generation-receipt` (optional)

## Outputs

`content-generation-receipt` `response/response.md`
`content-brief` `response/brief.md`
`e2e` `response/data/e2e.json` (optional)
`content-review` `review/response/review.md`
`article` `response/artifacts/article.<language>.md`
`image` `response/artifacts/image.<name>` (optional)
`image-prompt` `response/artifacts/prompt.<name>.txt` (optional)
`track` `response/artifacts/track.<language>.<extension>` (optional)

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `BRIEF_UNBOUND`, `OUTCOME_UNCOVERED`, `IMAGE_UNAVAILABLE`, `CODE_BUILD_FAILED`, `E2E_FAILED`, `CONTRACT_WEAKENED`, `REVIEW_REVISION_REQUIRED`*, `REVIEW_ROUNDS_EXHAUSTED`
