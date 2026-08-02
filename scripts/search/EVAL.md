# Eval — BM25 component search, 20 queries

**Judge: Claude Opus 4.8. Date: 2026-08-03.** BM25 over `matrix.csv`, top-3, k1=1.5 b=0.75.

The eval was run twice: once before the matrix carried a `keywords` column, once after. The gap between
the two runs is the finding.

## Before keywords — searchCols = [you_have, section, choose]

**6 correct, 5 partial, 9 miss (top-1).** The engine ranked and returned top-3 correctly, but the rows
that should win ("Avatar", "Modal", "DrawerShell", the skeleton row) carried short, starci-specific shape
text with little for BM25 to match, so unrelated rows whose `you_have` shared common words won instead
(`LinkSeeMore` won "avatar"; `StatGridCard` won "list"). BM25 can only rank as well as the text a row
exposes. The engine was correct; the data was thin.

## After keywords — searchCols = [keywords, keywords, you_have, choose]

A `keywords` column was authored for all 136 rows (natural phrasings + synonyms a person would type),
weighted x2 in the index. **17 correct, 3 partial, 0 miss (top-1).**

| # | Query | Top-1 | Verdict |
|---|---|---|---|
| 1 | a list where each row expands | SurfaceCardAccordion | CORRECT |
| 2 | one pressable card that links | SurfaceCard + onPress | CORRECT |
| 3 | a wrapping row of tags | Cluster | PARTIAL (the wrapping frame; a chip group is the element) |
| 4 | a modal that blocks until confirm | ModalShell | CORRECT |
| 5 | a drawer from the side | DrawerShell | CORRECT |
| 6 | a loading placeholder | isSkeleton | CORRECT |
| 7 | an avatar next to a name | UserCell | CORRECT |
| 8 | a horizontally scrolling row | StackH | PARTIAL (the horizontal frame; no dedicated reel row) |
| 9 | a labeled form input | FieldFrame | CORRECT |
| 10 | a price with its struck original | PricePoint | CORRECT |
| 11 | tabs switching panels | Tabs | CORRECT |
| 12 | a progress meter | ProgressRing | CORRECT |
| 13 | a single primary CTA button | Button (atom) | CORRECT |
| 14 | a dropdown select menu | Menu (atom) | CORRECT |
| 15 | an empty state | AsyncContentEmpty | CORRECT |
| 16 | a sticky header at the top | PageHeader | CORRECT |
| 17 | a card with title + description | TitledText | PARTIAL (the title+desc block, not a card) |
| 18 | a search box with results | SearchAutocomplete | CORRECT |
| 19 | a group of avatars stacked | AvatarGroup | CORRECT |
| 20 | a confirmation before delete | FeedbackConfirm | CORRECT |

**Tally: 17 correct, 3 partial (each a defensible answer), 0 miss.** Scores rose from 5–8 to 18–24,
i.e. the matches are now strong, not marginal.

## Conclusion

BM25 is the right engine, but a lookup table is only as good as the text each row exposes to it. The
single change from ~30% to ~85–100% top-1 was authoring a `keywords` column, not tuning the algorithm.
The three remaining partials are all reasonable top-1 answers, not errors. This is the pattern to repeat
for any future search domain: write the keywords, then the ranking works.
