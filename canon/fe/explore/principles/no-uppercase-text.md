# No uppercase text unless it is approved for that spot — STRICT

## The rules

**`uppercase` / `text-transform: uppercase` / hand-typed ALL-CAPS is banned in the UI** — labels,
eyebrows, tooltip titles, section labels, chips, badges. Text stays in sentence case, exactly as the
translation source wrote it.

The reason is legibility before taste. Reading research going back to Tinker's legibility studies,
and Nielsen Norman's restatement of it for screens, finds all-caps measurably slower to read: every
word becomes the same rectangle, so the ascender-and-descender shape the eye actually uses to
recognise words is gone. Uppercase costs the most on exactly the text it is usually applied to —
short labels read in passing, at small sizes.

**Do not capitalise on your own initiative**, including eyebrows above a heading and caps-locked
section labels. All-caps is used only where it has been approved for that specific place, which in
practice means a wordmark or a piece of set typography somebody drew deliberately.

**A secondary label is demoted with SIZE and COLOUR, not with case** — `text-xs text-muted`. Setting
a label in caps to make it "look like a label" adds visual weight to the least important text on the
surface, which is the opposite of what it needs; Refactoring UI's advice to de-emphasise rather than
emphasise is the same move stated from the other side. A quiet eyebrow is small and muted, never
uppercase.

Where a design genuinely wants the horizontal band that caps produce — a table header, a legal
notice — get it from size, letter-spacing and colour instead, and keep the words readable.
