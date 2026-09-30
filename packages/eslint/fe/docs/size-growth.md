# Size growth

Law module: `size-growth.mjs`. Catalogue: R20 HFS_SIZE_GROWTH.

A source file has a line budget, `ruleParams.fe.fileLines` of `knowledge/hfs/slots.yaml`, read through the slot view `hfsOf(context).ruleParams` (the package ships its own copy of the manifest in `runtime/`). A file over the budget may not be new and may not be longer than it was at the parent commit; a file within the budget is never a finding. The rule takes no option, there is no baseline file and no allowlist: the record is the repository's own history. `*.d.ts` declaration files are not governed.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/file-size-growth`

A source file over the budget is neither new nor longer than its recorded size.

**Invalid** (`src/components/Card/index.tsx`)

```ts
// a new file with more lines than the budget, or an existing file over the budget that gained a line
```

**Valid** (`src/components/Card/index.tsx`)

```ts
// a file within the budget, or an oversized file that stayed the same size or shrank
```

**Finding code:** `HFS_SIZE_GROWTH`

**Why:** `<file>` exceeds the line budget: a new file is already too long, or an old file is longer than its version at the parent commit. Every file must be small enough for one person to read entirely and one test to cover entirely.

**Fix:** Split the new part into its own file by responsibility; a file already over budget may only stay the same or get shorter.
