# docs/

The documentation source. `sites/docs/` renders it; this folder is the content.

## The split

| Path | Who writes it |
| --- | --- |
| `index.mdx`, `getting-started.mdx`, `concepts/*`, `contributing.mdx` | A person |
| `reference/**` | `scripts/generate-docs.mjs` — never edit by hand |
| `vi/**` | The same split again, in Vietnamese |
| `_meta.js` | Sidebar order for the folder it sits in (Nextra 3 dropped `_meta.json`) |

English pages are the ones that match the runtime, because English `.md` files in this tree are the
only runtime authority. The pages under `vi/` are human mirrors written as connected Vietnamese
prose, not as a word-by-word translation; the generated pages under `vi/reference/` use the tree's
own `.vi.md` mirrors wherever they exist.

A hand-written page explains and links. Where a rule already lives in a file of this tree, the page
quotes that file or links to it; it never restates the rule in its own words, because a restated rule
becomes a second home that nobody remembers to update.

## The generator

```bash
node docs/scripts/generate-docs.mjs           # write reference/ and vi/reference/
node docs/scripts/generate-docs.mjs --check   # exit 1 when the committed output differs
```

It reads the tree at build time and produces:

| Page | Source |
| --- | --- |
| `reference/operators/<id>` | `operators/<id>/operator.md` (+ `.vi.md`) and `operator.json` |
| `reference/workflows/<id>` | `workflows/<id>.json` |
| `reference/kinds` | `templates/kinds/*.contract.json` and `*.schema.json` |
| `reference/alias` | `alias/INDEX.md` (+ `.vi.md`) |
| `reference/stop-codes` | the Stop codes section of `operators/INDEX.md` (+ `.vi.md`) |
| `reference/knowledge` | `knowledge/ui/INDEX.md`, `knowledge/grammars/starci/INDEX.md`, `knowledge/patterns/fe/INDEX.md` (+ mirrors) |

It also writes the `_meta.js` of every folder it owns, so a new operator or workflow appears in the
sidebar with no hand edit.

The writer is idempotent: it renders every page into memory, then makes `reference/` and
`vi/reference/` exactly that set of files, deleting anything else it finds there. `--check` compares
without writing and lists every missing, stale or extra file. Line endings are normalised on the way
in, so a CRLF source file and its LF sibling generate byte-identical pages.

Source text is copied verbatim. Only two characters are escaped, and only outside code spans and code
fences: `<`, which opens a tag in MDX, and `{`, which opens an expression. Relative links inside a
copied file are rewritten to the file they point at in the repository, because the site has no such
path.
