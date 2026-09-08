# interface.draw document-filter scenario report

> Historical execution report. Calls and original validation used `../operator-under-test.json`.
> Rejected generated images and preview copies were subsequently deleted at the user's request.
> Retained prompts and generation metadata document those attempts; a removed image is not a deliverable.
> Current acceptance records and criteria validation are recorded separately when present.

## Execution

- Work: `document-filter`, revision 1; request: `document-filter-001`; retained attempt: `attempt-1`.
- The supplied baseline was opened and inspected before prompting. The built-in ImageGen tool received the actual baseline through `referenced_image_paths` and returned one real PNG. Its default saved result was copied unchanged into the scenario artifact directory.
- Image calls used: 1 of the allowed 2. No revision was needed after pixel inspection.
- Request validation passed before generation. Final validation ran against the compiled operator, the retained request, the retained response, and this scenario work root. It returned `machinePassed: true`, all 11 declared machine checks passed, and no failures. The exact result is retained at `artifacts/document-filter-001/attempt-1/validation.json`.

## Source grounding

- `D:/Repositories/nivo-backend/src/modules/bussiness/agentos-accounting/accounting.service.ts` — SHA-256 `6daf40e2f6475e4708a2e530f5ee741a28165c2ad12cdc06bac14287ecc8400e`. The `readWorkbench` document query selects `file_name`, `classification`, `period_key`, and `status`, establishing the supported search/filter concepts.
- `D:/Repositories/nivo-backend/src/modules/bussiness/agentos-accounting/accounting.types.ts` — SHA-256 `db8f8d2d70e24c12f3f9c41327d2997fb3a5b4ee7e357ddea8e6e29d764b3b76`. It defines the four classifications as `income`, `expense`, `receivable`, and `payable`, and exposes workbench documents as server-returned records.
- `D:/Repositories/nivo-backend/src/features/core/api/core/graphql/agentos-accounting/graphql-types/output.ts` — SHA-256 `22767a6c0561084b64543d9537c8789de21358b5f4d043fb619ad6e4a57c588d`. It exposes `documents` on `AccountingWorkbenchType`.
- A bounded `rg` search of `D:/Repositories/nivo-fe/apps/app/src` and `D:/Repositories/nivo-fe/packages` found no Accounting workbench operation or component. The supplied baseline was therefore used as the visual source of truth, and the backend query as the data-field source of truth.
- Compiled operator: `D:/Repositories/starci-skills-v3.0/.dist/operators/interface.draw.json` — SHA-256 `23ccab47fc3e2c7bbb698836a86267d74930d6fa8362cd8bd630b1bd8206714c`.
- Baseline: `context/baseline.png` — SHA-256 `979c9221521f73caef2b6e340545e31d0d2f566f44e84e737391e2e8057a3934`.

## Pixel review

The retained image is a valid 1536 x 1024 PNG. It adds a compact row directly between the status tabs and table: a magnifying-glass `Search file name` field, labeled `Classification` and `Accounting month` selects showing `All classifications` and `All months`, plus a right-aligned `Clear filters` action. The row is readable, aligned, and visually consistent with the existing native controls.

The current ledger remains explicitly `Immutable snapshot (view-only)` with its lock icon and as-of controls. The two-column layout, three document rows, status tabs, blue palette, typography, and unrelated panels remain visible and materially faithful. The Documents card grows downward, but the generator compensates by tightening vertical spacing so all baseline panels remain on the canvas. A few existing file-type icons are rendered with minor shape differences, a normal raster-edit limitation that does not alter meaning. The visible ICU-style literal under Pending corrections (`{count, plural, =0 {None} one {# item} other {# items}}`) is inherited from the supplied baseline and remains pre-existing visual debt; it was not introduced by this edit.

Verdict: `done`. All four request criteria passed visual review. Interactivity and keyboard behavior remain implementation requirements; the PNG demonstrates placement and affordance only.

## Contract notes

- The operator requires an actual image result to be persisted but does not state whether a host-default output should be moved or copied. The image-generation skill specifies copying for project use, so the original host output was left intact and the bytes were copied into the attempt directory.
- The operator's workspace aliases describe a `.works/<workId>/` layout, while this scenario explicitly assigns `tests/scenarios/document-filter/` as the work root. Validation accepts the explicit work root because its directory name matches `workId`; this report records the scenario-specific binding.
