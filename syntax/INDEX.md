# syntax

The shape of this tree. Not what any law says — what a law LOOKS like, where it sits, what it must
publish to run, and how it proves it works.

Read this before adding a shelf, a module or a record. A file in the wrong shape is not untidy: the
docs sync skips an incomplete module **silently**, so a module missing one record simply never
appears, and nothing reports it.

| File | Answers |
|---|---|
| [`layout.md`](layout.md) | Which directory holds what, and where a new thing goes |
| [`records.md`](records.md) | The five files in a module: frontmatter, headings, tables, and which language each is written in |
| [`gate.md`](gate.md) | What a shelf must accept and emit to run in the chain |
| [`proof.md`](proof.md) | The held-out test a shelf carries as evidence it works |

## The chain, in one line

```
prompt · image · feedback → layouts → blocks → principles → patterns → lints → code
```

Five shelves. Each takes a defined input and returns a defined output, and the output of one is the
input of the next. A shelf that cannot state both is a rulebook rather than a gate.

## The three rules that outrank everything in these four files

**Canon records what the code already does.** A law is anchored to source that can be checked, or to
a founder's recorded refusal in `.workflows`. A rule with neither anchor is a proposal, and it says so
on its own line instead of sitting among the laws looking like one.

**A code has exactly one owner.** Before adding a prefix, sweep the whole tree for it. Moving a code
without checking the destination namespace does not resolve a collision, it relocates one — that
happened twice in one session, and the second was caused by the fix for the first.

**A gate that does not know, asks.** It does not pick a default quietly. And the two silences are
repaired differently: the gate being silent needs a rule, the requirement being silent needs a
question back to the user. Writing a rule for the second is how a gate stops being honestly stuck and
starts being confidently wrong.

## Language

`INDEX.md` is English because it is the law that skills read and quote. `vi.md`, `example.md`,
`audit.md` and `changelog.md` are Vietnamese. Inside a Vietnamese file, headings, code identifiers,
paths, rule codes and exact source quotes stay untranslated — translating them breaks a gate or an
evidence chain. Details in [`records.md`](records.md).
