# Typography

The type scale lives inside one text component, selected by a named role. It is not a set of loose
utility classes, and reaching for those instead puts a size in the tree that no other component
shares — which is how a product ends up with six sizes between 15px and 18px, none of them
deliberate.

Material's type scale makes the same move by naming roles rather than sizes: display, headline,
title, body, label. Refactoring UI arrives from the other side and says to hand-pick a small set of
sizes rather than generating a ratio, because a mathematical scale produces steps you will never use
and gaps where you need one.

## 1. A closed set of named steps

A workable scale for an application: six heading steps at 36, 30, 24, 20, 18 and 16px, all of them
sharing one weight and a tightened tracking. Headings do not need a separate weight axis — a
semibold baked into every step is one fewer decision at every call site, and heading hierarchy is
carried by size, not by weight.

Body sizes are three: 16px with a 28px line height, 14px with 24px, 12px with 20px. Code is 14px
monospace on a neutral fill. Line height is part of the step, not a separate choice, because the
pairing is what makes two paragraphs at different sizes look like the same typeface rather than two.

## 2. A weight axis only means something for body text

Normal, medium, semibold and bold change the weight of prose. Do not push a weight onto a heading
step: it is already fixed, so the override either does nothing or fights the baked style, and either
way it tells the next reader that the heading scale has an axis it does not have.

## 3. The colour prop carries exactly two values

Default and muted. Every other colour — accent, success, warning, danger — is a deliberate override
rather than a variant of the text component, because a text component that can be any colour is a
text component that will be. See [[color]].

## 4. A page title and a dialog title are DIFFERENT sizes on purpose

The page title is a heading step; a dialog header is body text at semibold, one full step down. The
dialog is a smaller surface making a narrower claim on attention, and carrying the page's heading
size into it makes a confirmation prompt shout as loudly as the page behind it.

This is the same reasoning as elevation-by-role: the size follows what the surface IS, not how
important the author feels its content is.

## 5. Verify that the font variable you reference actually resolves

A theme that declares `--font-sans: var(--font-body)` where `--font-body` is defined nowhere fails
silently — the utility falls back to the operating system's sans stack, and on the machine where it
was written that stack looks close enough to pass review. If the font is attached directly to the
body element by a font loader and never passes through the variable, then every use of the variable
OUTSIDE the body is rendering in a different typeface than the rest of the product.

Check it by setting the variable to something absurd for a moment. If nothing changes, nothing was
reading it.

## 6. A serif utility with no loaded serif face is a trap for non-Latin text

With no serif family declared, a serif utility falls back to the operating system's serif. Those
stacks are reliable for Latin text and unreliable for everything else: stacked diacritics detach
from their vowel, and scripts outside the face's coverage fall back glyph by glyph, producing a line
in three typefaces.

Do not use a serif utility until a face with the coverage your product actually ships in has been
loaded deliberately. This is not a polish issue; it is a legibility failure that native readers see
instantly and the person who wrote the CSS never sees at all.

## 7. Monospace is for code

Use it for genuine code, identifiers and fixed-width data such as a hash or a version. Do not reach
for it to make an ordinary label — a model name, a plan name — look technical. Monospace carries the
meaning "this string is exact and you may need to copy it", and spending that meaning on decoration
leaves nothing to say it with.

## Related

[[header]] · [[color]] · [[chip]].
