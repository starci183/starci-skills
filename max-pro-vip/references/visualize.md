---
name: visualize
description: When to build options for the teacher to look at instead of coding right away, when to draw a widget instead of a long chat message, and which tool to present with.
---

# Visualize

**Drawing is the default output of both lanes, not a special occasion.** A candidate entry, a
candidate arrangement, a proposed library addition — all of them are rendered, never described in
prose and put to a vote in words.

## How many to draw

| Valid candidates | Draw |
|---|---|
| two or more | all of them, side by side, at the same width — the teacher picks |
| exactly one | that one, plus the sentence *"the data forces this, there is no option two"* |
| none | the proposed new library entry, as a proposal the teacher rules on |

**Never manufacture a choice.** If the data shape admits exactly one entry, drawing three more to
look thorough invites a wrong pick. One drawing with its reason beats four with a fake question.

**Never draw with placeholder content.** Use the real field names from `be code` and the real record
count. A widget showing three rows where production shows three hundred is a lie about the only
variable the arrangement depends on.

## Two rules that pull in opposite directions — don't mix them up

| Case | Who's missing the picture | What to do |
|---|---|---|
| **Brainstorm** | **the teacher** doesn't have a fixed picture yet | build 2-3 concrete options, present them for the teacher to choose |
| **Explain** | **you** have something the teacher needs to understand | draw a picture, then keep working |

## Brainstorm — vague feedback means don't code

Signs of vagueness: *"breaks the rules"* · *"cheap-looking"* · *"render it differently"* · *"cluttered"* · *"looks boring"*.

A critique with no concrete direction means the teacher **doesn't have a fixed picture yet**. Picking one interpretation yourself and fixing it is guesswork, and it always has to be redone on the second round.

Build 2-3 **concrete** options, then present them. The teacher settled this rule in his own words: *"whenever the teacher says something like this, brainstorm, re-render with the new component, and send the teacher HTML."*

**Conversely:** feedback that already has a clear direction (*"chip on the left, plain text on the right"*, *"even gap for these three"*, *"rounded-none"*) should be **applied directly, no brainstorming**. Asking again about something already clear just slows things down.

## Explain — confusing means draw, don't chat

There's a concept, a trade-off, a reason behind a decision that the teacher needs to understand ⇒ draw a diagram, a comparison table, a before/after. Then **keep working right away** — don't stop to ask more if the work in progress doesn't actually need the teacher to decide.

The teacher settled this: *"whatever's confusing, don't chat about it — draw a widget to explain it."*

## Which tool — choose by SIZE

| Size | Tool | When |
|---|---|---|
| small — compare a few variants of **one cluster** | `mcp__visualize__show_widget` | changing one row, one chip, one arrangement |
| large — simulate an **entire block / entire page** | HTML file opened via the `web-preview-8080` port | need the real context: real theme, real colors, real width |

A large mockup **must be styled to match the app's real interface**, not the widget's default light theme — the teacher needs to see how it looks sitting inside the real screen.

**Port:** use `:8080`. Don't use `:6006` (Storybook — an isolated canvas per component, no real theme/background/width). Don't use `:3000` (may be running another one of the teacher's chat sessions).

## Red flags

- "The teacher's critique is generic, but it probably means X" → that's a guess. Build options, let the teacher point.
- "Explaining in words is faster" → the teacher already had to ask again about something answered once in prose. Draw it.
- "The default widget is clear enough" → a large mockup without the real theme means the teacher is looking at something different from what will ship.
- "The teacher was clear, but I'll build a few options just to be safe" → a clear direction means apply it directly.
- "Only one entry fits, but four options look more thorough" → a manufactured choice invites a wrong pick. Draw one, say why there is no second.
- "I'll sketch it with lorem for now" → the widget then proves nothing. Real fields, real counts.
