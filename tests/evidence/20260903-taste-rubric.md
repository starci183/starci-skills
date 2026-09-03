# Evidence — the taste rubric, 2026-09-03

Knowledge rules are product-agnostic, so the two pieces of evidence behind `knowledge/ui/proof/taste.md`
live here. The topic publishes `TASTE-1` to `TASTE-13`; every criterion below is stated as a measurement
taken from a capture, not as an opinion about a product.

## Evidence 1 — the owner ruling

The owner rejected a surface that had passed the whole canon lane, in one sentence: a surface that is
correct by grammar and ugly by eye is still thrown away. Three things follow from it, and they are the
reason the topic exists rather than a style guide entry.

| # | What the ruling settles | Consequence in the topic |
| --- | --- | --- |
| 1 | Canon conformance is necessary, never sufficient | A taste verdict of `fix-first` stands even when every canon rule passed (`TASTE-13` Case 3) |
| 2 | A rejection may not be a mood | Every criterion names a threshold visible in a capture, so a reviewer reports a count, an edge, a ratio or a rectangle |
| 3 | Bad taste is a composition failure | Taste findings route to `direction`, never to `resolve`, because no value swap repairs a composition (`TASTE-13` Case 4) |

## Evidence 2 — the worked example

A console overview surface, product name deliberately omitted. It passed the canon lane with no finding:
owners were correct, tokens were on scale, the accessibility and contrast proof were clean. Scored against
the twelve criteria from a wide light capture it landed at about three out of five, and four of the failures
were visible before reading a single word of copy.

| Criterion | What the capture showed | Verdict |
| --- | --- | --- |
| `TASTE-1` | The page title and the first section title rendered at the same size and weight, so the frame had no single largest element and the eye landed nowhere | fail, 2 |
| `TASTE-2` | A tinted band roughly 180px tall whose only occupant was a decorative artwork, carrying neither content nor separation | fail, 2 |
| `TASTE-5` | Three warning rows rendered in the same neutral surface and text colour as the ordinary rows beside them, so a warning was indistinguishable from a fact | fail, 2 |
| `TASTE-8` | The same artwork as the band's only justification, an ornament filling a void it had itself created | fail, 2 |
| `TASTE-12` | The direction named a glanceable console grid as its class; the capture rendered a single vertical list, which a stranger would sort into a plainer class | fail, 2 |
| `TASTE-3`, `TASTE-4`, `TASTE-6`, `TASTE-7`, `TASTE-9`, `TASTE-10`, `TASTE-11` | Nothing wrong and nothing convincing: edges aligned, one radius family, three type sizes, states present | pass, 3 to 4 |

Mean across the twelve was roughly 2.8, and four of the five gating criteria failed, so the verdict is
`fix-first` under `TASTE-13` Case 2 even though the canon lane was green. This is the case that fixes
the gate list: `TASTE-1`, `TASTE-2`, `TASTE-5`, `TASTE-8` and `TASTE-12` are exactly the criteria this
surface failed, and they are the ones a reader registers in the first glance.

## Why the thresholds are the numbers they are

| Threshold | Where it comes from |
| --- | --- |
| `64px` of empty band (`TASTE-2`) | Below that height an empty strip reads as spacing; the failing band was near three times it |
| One accent call to action per view (`TASTE-5`) | Matches the single dominant decision already settled in composition, measured after render instead of before |
| Three sizes and two weights per region (`TASTE-6`) | The failing surface passed this and still read flat, which is why the criterion caps voices rather than granting a score |
| Sixty percent data or action for a console class (`TASTE-9`) | The failing capture measured near forty percent once the tinted band and its artwork were excluded |
| Mean of at least 4 (`TASTE-13`) | A surface scoring 3 on everything is inoffensive and unfinished; the example scored 2.8 and had to be rejectable without argument |
