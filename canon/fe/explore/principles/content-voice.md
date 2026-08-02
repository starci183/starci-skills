# Content voice

The umbrella over the two narrow rules — no emoji, no uppercase — plus the localisation rules that
tend to be written for a marketing page first and then turn out to govern **every** string in the
product.

## The test

**Copy reads as though it was written in the reader's language, not translated into it: no source
language left standing where the target language has a good word, translated by MEANING rather than
word for word, every locale complete; no emoji; no uppercase.**

## The rules

- **Keep a source-language term only when the field itself keeps it untranslated** — API, CI/CD,
  production. An ordinary word with a good equivalent gets translated. The test is not "is this
  word technical" but "does a practitioner in this language actually say it this way at work".
- **Translate the meaning, not the words.** An idiom rendered literally reads wrong in every
  language; find the phrasing a native speaker would have reached for. Machine-shaped copy is
  usually detectable in one sentence, and it discounts everything around it.
- **Every locale is complete.** A key that exists in one language and not another is not a small
  gap: it renders as the raw key or as an untranslated fallback, in the middle of otherwise fluent
  copy, which reads as a defect rather than as a missing translation. The W3C's internationalisation
  guidance treats string completeness as part of the build, not part of the polish.
- **Labels in the same row or group share a rhythm** — comparable length and structure. One label
  that runs long breaks the reading cadence of the whole group, and it is worse after translation,
  where expansion of a third or more over the source is ordinary. Design the group to survive it.
- **No emoji** in any label or string. They are the one glyph class with no typographic control: the
  rendering differs per platform, the meaning drifts by culture, and a screen reader announces the
  full name of each one in the middle of the sentence. Where a symbol is genuinely needed, use an
  icon from the icon set, which can be sized, coloured and labelled.
- **No uppercase or all-caps**, unless one specific place has been argued for and approved. All-caps
  removes the word shape that fast reading depends on and measurably slows it; Material and Fluent
  both moved their labels to sentence case for this reason. A subordinate label is ranked down by
  small size and muted colour, which are the channels that exist for ranking.

Related: `visual-hierarchy.md` — an eyebrow label is quiet, neither capitalised nor heavier than the
thing it introduces; `no-emoji.md`; `no-uppercase-text.md`.
