# How a pattern is written here

A pattern file is not a style guide someone had opinions about. It is a **record of what this
codebase already does**, written down so the next file matches the last one. That single sentence
decides everything below.

Read this before adding a rule, editing one, or deleting one.

## The one test a rule must pass

> Can you point at the code this rule describes — a file, and how many places do it that way?

A rule that cannot answer is not a rule yet. It is a preference, and preferences do not belong
here, because the moment two preferences disagree there is nothing to settle them with.

```markdown
Grounded:   The real idiom (669 files, re-measured 2026-07-31): the type import of
            `WithClassNames` from `@/modules/types/base/class-name` sits at the END of the
            import block, deliberately breaking the order in §3.

Ungrounded: Type imports should go at the end of the block; it reads better.
```

The first can be checked, argued with, and shown to be out of date. The second can only be agreed
with or ignored.

## Anchors, and why they carry a date

Every rule names the file it was read from and the day it was measured. Not decoration — the
anchor is the only thing that makes staleness *visible*:

- `371 file extends WithClassNames` was true on 2026-07-14
- fourteen days later it was **669**, and the rule still read 371

The rule was still correct. Its evidence was not, and a reader quoting "371" would have been
quoting a number nobody could reproduce. `verify.mjs` recounts these; run it before trusting a
file you did not just write.

Four anchors in this set pointed at files that had been **moved** — `layouts/` became
`features/`, stories moved out of `src/` into `.storybook/`. Nothing was wrong with the rules;
the paths under them had shifted. That is the normal failure, and it is silent without a check.

## One example is not a rule

Promoting a single observation to a general rule needs **two independent sources**. One occurrence
is an anchor to that case — say so plainly rather than writing it as law:

```markdown
Honest:      Anchored to ChallengeBrief.tsx:240 — not yet a general rule.
Overreach:   Never pass ReactNode to a title prop.     (seen in one file)
```

This is the rule that keeps the set from doubling in size every month with laws nobody can trace.

## Shape: what goes inline, what gets its own file

Borrowed from how the public skill collections split their material, and it holds here:

| | Where |
|---|---|
| a principle, a rule, a code pattern under ~50 lines | inline |
| reference material over ~100 lines | its own file |
| anything a script can check | a script, not prose |

That last row is the one people skip. `matrix.md` in this same repo grew to 75 KB of lookup table
written as prose, and every lookup had to load all of it. If a thing is a table, make it a table
someone can query; if it is a rule about how code is spelled, prose is right.

## No tick and cross marks

Write the judgement in words. A rule that needs a ✅ beside it to be understood is a rule that has
not been written yet.

```markdown
Right:  Never restate what the code already says:
            // reset the input
            setBody("")

Wrong:  ❌ // reset the input
```

The marks are not merely redundant, they are load-bearing in the worst way: strip the ❌ from a
counter-example and it reads as the recommended form. Anything whose meaning collapses when a
glyph is removed was resting on the glyph.

In a code block, label the counter-example inline — `// Wrong: …` — and let a good example carry
its source path alone, since the path is what makes it credible:

```ts
// src/components/blocks/chips/TagChips/index.tsx
export const TagChips = ({ tags, maxVisible = 3 }: TagChipsProps) => {

// Wrong: reading props off the object instead of destructuring in the signature
export const TagChips = (props: TagChipsProps) => { const { tags } = props … }
```

## Voice

**Say why.** A rule whose reason is written down survives contact with a case its author never
saw; a bare imperative does not, and the reader either obeys it where it does not belong or
ignores it where it does.

**Show one excellent example, not five mediocre ones.** Complete, copied from the real source,
commented with the reason — not a fill-in-the-blank template.

**No narratives.** "We spent a day discovering that…" is a session log. What survives is the rule
and its anchor; the story belongs in the session file.

**Prefer the codebase's own words.** If the team says `bussiness` with the typo, the pattern says
`bussiness`. A pattern file that silently corrects the codebase teaches a spelling that will not
compile.

## Two conventions that disagree, and what we do

The public collections split on one point, and it is worth knowing which side a file is on:

| | Says | Reason given |
|---|---|---|
| Anthropic's `skill-creator` | a description states **what it does and when** to use it | triggering is the whole job of the description |
| obra's `superpowers` | a description states **only when** to use it, never the workflow | testing showed agents follow a summarized description *instead of* reading the body |

Both are empirical claims about the same mechanism, so neither is obviously right. The skills here
follow Anthropic's shape — the description opens with what the skill does — **and** keep the body's
procedure out of it, which is the failure superpowers actually measured. If a skill ever starts
being obeyed from its description alone, that is the signal to cut the description back.

Pattern files are not skills and carry no frontmatter; this section is here because the same
question comes up whenever one of these becomes a skill.

## Changing a rule

1. Read the source first. The rule may already be describing something that moved.
2. Change the rule, the anchor, and the date together. An anchor left behind is worse than none.
3. `node .claude/patterns/verify.mjs`
4. If the check disagrees with you, **read its output before editing the rule**. Three times while
   building this set the check was the thing that was wrong: it matched an ellipsis as a path, it
   read a substring `src/…` out of `apps/core/src/…`, and it demanded lowercase where the real
   output was uppercase. A failing check is a question, not a verdict.

## Deleting a rule

Delete freely. A rule the linter already enforces, or `tsc` already rejects, is costing a reader
attention and buying nothing — a scan of the sibling canon found **46% of its prohibitions were
already machine-caught**. The rules worth keeping are the ones no gate can catch: the type-valid,
lint-clean, renders-fine mistakes.
