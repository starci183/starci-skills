# tinkle-21 — tests + fixtures distless

Read `tinkle/_common-distless.md`. Owns: `tests/**`, `fixtures/**`, `ex-testing/**` (except briefs/).

Mission: every test/fixture referencing `.dist` paths or invoking build steps must work against source dirs. Grep `\.dist` under your scope. If a test asserts compiled output exists (e.g. reads .dist/schemas json), point it at `schemas/*.yaml` via parseYaml. If a test needs a built artifact that no longer exists, adapt to source — report any test that becomes meaningless. Run the affected tests after edits where feasible. Report `tinkle-21-REPORT.md` + marker `done/tinkle-21.done`.
