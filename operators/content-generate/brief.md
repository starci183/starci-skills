# content.generate — brief

Generated from `operators/content-generate/operator.md`. Profile `luna`, dispatch `fresh`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Generate or refactor one educational content unit in one linear pass: a teacher brief that constrains everything after it, one written edition per declared language, images made to a stated claim, code and executable checks that actually run, and an independent review that receives the artifacts without the producer's rationale.

## Inputs

| Kind | Required |
| --- | --- |
| `content-generation-receipt` | no |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `unit` | id | — |
| `naturalLanguages` | list | vi |
| `implementationLanguages` | list | empty |
| `stageModes` | list of `{image}` | image off |
| `commands` | list of `{language,  | the commands the unit de |
| `maxE2eIterations` | number 1–20 | 2 |
| `maxReviewRounds` | number 1–20 | 2 |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `content-generation-receipt` | `response/response.md` | md | yes |
| `content-brief` | `response/brief.md` | md | yes |
| `e2e` | `response/data/e2e.json` | data | no |
| `content-review` | `review/response/review.md` | md | yes |
| `article` | `response/artifacts/article.<language>.md` | artifact | yes |
| `image` | `response/artifacts/image.<name>` | artifact | no |
| `image-prompt` | `response/artifacts/prompt.<name>.txt` | artifact | no |
| `track` | `response/artifacts/track.<language>.<extension>` | artifact | no |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `BRIEF_UNBOUND`, `OUTCOME_UNCOVERED`, `IMAGE_UNAVAILABLE`, `CODE_BUILD_FAILED`, `E2E_FAILED`, `CONTRACT_WEAKENED`, `REVIEW_REVISION_REQUIRED`*, `REVIEW_ROUNDS_EXHAUSTED`

## Next

`workspace.bind`
