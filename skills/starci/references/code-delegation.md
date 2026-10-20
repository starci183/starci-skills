# Code delegation

Any delegation that writes product code runs the op loop of `knowledge/op-gate.yaml`: a Kernel op, a plain-chat subagent, a
lane worker or the chat itself. Being dispatched from a chat instead of by the Kernel changes who settles the result, never
the loop. Code first and lint or specs afterwards is refused.

1. READ: `starci gate read --root <app> --touch <files...> --out read-digest.json`, then read every file it lists.
2. CODE: the change together with its unit specs (`<name>.<role>.spec.ts` beside each new logic file).
3. CHECK: `starci gate run --root <app> --base <commit the change started from> --changed <files...> --tests <pattern> --out gate.json`.
   The gate judges every file that differs from the base plus the `--changed` files; `--changed` never narrows that slice, so
   `--base` is what scopes it (inside a Kernel workflow the default base is the previous checkpoint).
4. FIX: repeat CODE and CHECK until the gate exits 0. A finding the base already has is preexisting and is not fixed here;
   exit 2 is a tool that could not run, never a pass.
5. REPORT: attach both JSON documents, `read-digest.json` and `gate.json`, unedited.

The worktree has the app's git hooks before the first commit: install with `starci npm ci` (it runs the declared hook
installer after the install), and `starci app check` reports `HFS_HOOKS_NOT_INSTALLED` when they are missing. Commits go
through the hooks; `--no-verify` is never used. The pre-commit hook refuses a new logic file staged without its spec
(`BE_UNIT_SPEC_NOT_STAGED`).

## Brief template

Paste this into every code-writing delegation and fill the angle brackets:

```text
Task: <one outcome>. App root: <absolute app root>. Files you may write: <paths or globs>.
Install: starci npm ci at the app root before editing (installs the git hooks); never npm ci --ignore-scripts.
Op loop, in order, no step skipped:
  1. starci gate read --root <app> --touch <files> --out read-digest.json, and read every file it lists.
  2. Write the code and its unit specs together (<name>.<role>.spec.ts beside each new logic file).
  3. starci gate run --root <app> --base <commit before your change> --changed <files> --tests <pattern> --out gate.json
  4. Fix and rerun step 3 until it exits 0; never --no-verify, never a lint suppression.
Report: the files changed, the commits, and both JSON documents (read-digest.json, gate.json) attached unedited.
```
