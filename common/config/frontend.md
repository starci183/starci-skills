# Frontend configuration

## Roles

- `fe` is the active frontend target and contract owner.
- `fe-legacy` is comparison/migration evidence only. It does not own the active contract and cannot
  replace `fe` merely because a legacy implementation already renders a shape.

Both roles use the `.claude/fe/` registry after common config and target instructions are loaded.

## Context order

For each FE role config:

1. Read `context.instructions`.
2. Read `context.contract` when present. For `fe`, this is primary domain/composition context and
   should be read before broad component searches.
3. Read `context.manifests` only to resolve package manager, scripts and workspace boundaries.
4. For FE design, read the role's `context.grammar`, then load exactly
   `.claude/grammars/<grammar>/grammar.json` and `profile.json`. Missing route stops the journey.
5. Before the first code write, read every applicable module under
   `.claude/fe/gates/patterns/<pattern>/` completely, starting with its `INDEX.md` and following the
   module's required references. No FE or FE-legacy code may be written before this gate.
6. Inspect source and tests as implementation evidence.

Select patterns from the actual change surface, not from one guessed filename. A change spanning
contracts, props, layout and comments loads every matching module. When applicability is unclear,
inspect the pattern registry and settle the set before coding.

If active `fe` has a known contract but its config route is null or stale, repair workspace setup
before contract-dependent work. If the repository genuinely has no contract, report that absence;
do not invent a path or silently substitute legacy code.

The contract owns semantic relationships, named slots, composition and `why`. Component source owns
current implementation/reuse evidence. `fe-legacy` owns only the parity states explicitly selected
by the user.

## Commands and config

Derive lint, typecheck, test, build and dev commands from the routed target manifests. Never encode a
machine-specific command, port, package manager or checkout path in this tracked common config.
Target lint config decides globs and application scope; `.claude/fe/` owns shared rules.
