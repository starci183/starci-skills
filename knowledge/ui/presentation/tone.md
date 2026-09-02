# Tone presentation

This file answers one question: given a line of copy whose rank is already decided, which public tone
prop expresses that rank?

Tone is a semantic choice, not a colour choice. The application selects how much attention a line
deserves; Grammar resolves that to a token. The application never writes a text colour class and
never overrides colour inside another Grammar component.

## Scale

The public tone set is closed and ordered by how much attention each level claims.

| Rule | Prop | Rendered token | Claims |
| --- | --- | --- | --- |
| TONE-1 | `tone="default"` | `text-foreground` | Ordinary reading attention |
| TONE-2 | `tone="muted"` | `text-muted` | Deliberately less than its neighbour |
| TONE-3 | `tone="accent"` | `text-accent-soft-foreground` | Scarce, one short span at a time |

`Text size="xs"` resolves to muted regardless of the tone requested, because the smallest size is
supporting information by definition. `Heading level={4}` carries the same muted treatment. Asking
for another tone at that size does not raise it.

## Owner

Tone belongs to Grammar. The owner cell names which component resolves the token.

| Owner | Meaning | Application writes |
| --- | --- | --- |
| A component name | `Text` resolves this tone | The prop only |
| `—` | The meaning has no public tone | Nothing. Report the gap |

There is no `App` owner in this file. A `text-*` colour class written by the application is
`APP_OVERRIDE`, and a raw hex or palette value is rejected even when it matches the token.

Status colour is not tone. Success, warning, danger, and information are semantic states owned by the
components that carry them, and they are never expressed by choosing a text colour.

## TONE-1 — `tone="default"`

The line reads at ordinary attention. This is the resolved tone when none is given, except at the
smallest size.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Copy or a fact the application ranked as normal reading content | `Text` | `<Text tone="default">Enrollment is active.</Text>` |
| Case 2 | The body of a paired title and explanation where both must be read | `Text` | Both lines stay default; weight separates them |

Not this rule: making lower-rank metadata compete with the content beside it. Use TONE-2.

## TONE-2 — `tone="muted"`

The line recedes on purpose, because something next to it carries the meaning.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A qualifier, unit, or timestamp attached to a fact stated nearby | `Text` | `<Text tone="muted">Taxes are calculated at checkout.</Text>` |
| Case 2 | The description under a title, where the title carries the identity | `Text` | `<Text size="sm" tone="muted">Ready for junior roles</Text>` |
| Case 3 | Any line at the smallest size | `Text` | `size="xs"` already resolves to muted |

Not this rule: the only sentence explaining an important fact, or hiding copy that is simply too
long. Muting an explanation nobody else states removes it from the page in practice.

## TONE-3 — `tone="accent"`

One short span stands out because its meaning is already exceptional in context.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A single short label whose emphasis the application has already decided | `Text` | `<Text tone="accent" weight="semibold">Recommended</Text>` |

Not this rule: whole paragraphs, repeated peers, or decoration. Accent repeated across siblings stops
marking anything. Accent also never carries meaning alone, because colour is not readable by every
reader.

## Contrast

Tone tokens are defined against the surface they sit on. A tone chosen on one surface and rendered on
another is a contrast finding, not a preference, and it is measured against the composed background
rather than the intended one.

The application changes the surface, never the token, when contrast fails.

## What this file does not decide

How large or heavy the line is set is [Font](font.md). Which surface it sits on, and the semantic
colour of that surface, are outside presentation entirely.
