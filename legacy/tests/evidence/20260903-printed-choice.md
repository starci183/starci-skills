# Evidence — a design choice handed to a person as prose, 2026-09-03

The print law (`@tools/print`, mode `decision-points`, release 1.6.1) already required every artifact
a decision rests on to reach the person before the decision is recorded. The two occurrences below
are the case it did not yet cover: the decision that is the person's own, handed over with nothing
to look at.

## Occurrence 1 — the audit that advised

A surface audit closed its taste lens as `fix-first` at the end of the direction laps its chain
allowed, and stopped with route `user`. What reached the person was two sentences: accept the
composition and record the density band as a seeded-data limitation, or handle the density band and
three family gaps first. No candidate was rendered for either option; the served sheet from the
audit showed the one surface the person had already rejected. The coordinating session then had to
advise in prose which sentence to pick, which is the thing the tree exists to make unnecessary.

The owner's ruling, in spirit: an operator does not advise; if it had to, the tree is not yet strong
enough. Printing three renders and asking the person to pick one is the only form of "advice" a
design decision may take.

## Occurrence 2 — the direction that stopped without its receipt

`DIRECTION_CHOICE_REQUIRED` under `approval-required` was a lawful stop whose validated shape carried
the candidate pages and no receipt. The candidates existed on disk and had been served, but nothing
in the stop said which of them were the options, at which viewports they had been shown, or what the
person was being asked. The self-test of that operator encoded the gap: the "valid" blocked branch
had no `## Printed` table at all.

## What the two settle

| # | What the occurrences show | Where it now lives |
| --- | --- | --- |
| 1 | A `user` route over a design decision is a choice, and a choice is rendered candidates, one per option, at least three for composition or taste | the `decision-points` mode of `@tools/print` in `resources/tools.json`; the print paragraphs of `frontend.direction.decide` and `frontend.surface.audit` |
| 2 | The message to the person is the sheet URL and one question; alternatives written in prose are advice | the same mode; `response.json.reason` on the stop, checked by `choiceHandoffErrors` in `scripts/validate-response.mjs` |
| 3 | A yes/no operational approval is not a design choice and carries no candidate | the same mode; each operator's paragraph names its operational stops |
| 4 | Fewer printed candidates than options, or none, is refused, never read charitably | `operators/frontend-direction-decide/validate.mjs` on `DIRECTION_CHOICE_REQUIRED`; `operators/frontend-surface-audit/validate.mjs` on a `user` route with an open composition or taste topic |
