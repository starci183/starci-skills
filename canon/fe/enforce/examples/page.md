# page — in a real system

A list of functions — and the cleanest evidence the architecture works.

The rule is in [`../elements/page.md`](../elements/page.md). This is one system obeying it,
named so every row can be checked.

## What a page actually is

`CourseContents` imports **eight blocks and one composite**. Its body names them, arranges them in
frames, and passes typed data. That is the entire file.

It composes **zero** classes and takes **zero** `className` — and that holds across the page tier,
not just this one file.

That zero is the strongest single piece of evidence in the system: every shape a screen needed was
found one tier down, every time. Nothing had to be nudged into place at the top.

## Representative rows

| Component | Renders | Why this tier |
|---|---|---|
| `CourseContents` | a course's blocks, in frames, fed typed data | names blocks and passes data — nothing more |
| `ChallengePage` · `ChallengeResultPage` | the same domain before and after grading | two pages rather than one page with a mode flag |
| `ModulePage` · `ContentPage` | a module, a lesson | each gathers several blocks |
| `QuizPage` · `FlashcardReviewPage` | a study session | the session state lives in blocks below |
| `PlaygroundHubPage` · `PlaygroundPreparePage` · `PlaygroundSessionPage` | three stages of one flow | split by stage, because each gathers a different set of blocks |
| `LeaderboardPage` · `HeadhuntingsPage` | a ranked list, a directory | list pages are still lists of blocks |
| `PersonalProjectWorkspace` | a working surface with several regions | the widest page; still no shape of its own |

## Why a page reaching for an atom is a smell

Not illegal, but it has one cause: **a block is missing**. The page needed a shape, no block offered
it, so the page reached past two tiers and built it inline — where no other screen can find it.

The fix is never to allow the reach. It is to write the block.

## Thin by construction

Far fewer pages than blocks, each page gathering several. When pages start approaching blocks in
number, they have stopped being lists and started being builders.

---

Read from a live tree with `scripts/audit/scan-storybook-architecture.mjs`. Another repo answers with
different names, and its answer outranks this file.
