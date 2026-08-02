# patterns/

Everything in this folder runs. Nothing in it argues.

That split is the whole design. `canon/` holds the prose — the essays a person reads before
writing a component, the ones that explain *why* a block seam is wider than a group seam and what
a reviewer is allowed to insist on. `patterns/` holds the machinery that makes those essays
checkable: the registry of named decisions and the value each must compute to, the gates that
scan a source tree, the runner that measures a rendered node, and the search scripts that answer
a question about a rule without a human reading the file.

A rule that lives only in prose decays quietly. A rule that lives only in a script is enforced by
something nobody can argue with, which is worse — people route around a gate they do not
understand. So each rule lives in both places, once, and `patterns/fe/gates/check-canon-sync.mjs`
holds the two halves to the same numbers: every pattern in the registry that commits to a pixel
must have that pixel written down in `canon/fe/enforce/spacing/overview.md`, in the paragraph that names it.
When somebody widens a seam to make a test pass, the gate says so before the essay and the
machine have been disagreeing for a month.

## What belongs here

- `fe/patterns.mjs` — the registry. Every named layout decision and the value it must compute to.
- `fe/gates/*.mjs` — one gate per invariant. Each exits 0 or 1 and names what it found.
- `fe/runner/` — the rendered-tree test that measures a real node against the registry.
- `fe/search/` — read-only queries over the rules, for asking rather than grepping.
- `verify.mjs` — re-grounds the canon against the source it claims to describe.

Prose does not belong here. A paragraph of explanation inside a gate is fine and expected — the
gates are commented the way the rest of this set is — but a `.md` file that makes an argument
belongs in `canon/`, where `verify.mjs` will check its anchors.

## Every gate carries a test that has watched it go red

A gate nobody has seen fail is not known to gate anything. It is a script that has only ever
printed OK, which is indistinguishable from a script that cannot fail. So a gate ships with a
case in `test.mjs` that builds the smallest sandbox breaking exactly one of its rules, and
asserts the gate exits non-zero *and names that rule* — an exit code alone would also be produced
by a typo in a path.

The cases are named as the claim they make, not as the function they call, so the output of a run
reads as a list of promises this folder keeps:

```
  the gate must go red
ok    a canon quoting a different pixel fails, and names the token and both numbers
ok    a pixel the canon never wrote down fails, rather than passing quietly
```

Run them with `node patterns/fe/test.mjs`. Add a gate, add its red case in the same commit.
