---
name: push-git
description: >-
  Run the FULL test suites of the runtime (.claude) and of every product repository that has unpushed main commits, fix
  what is red, and only then push main. It is the ONLY place a full suite runs - ops, kernels, lands and .claude upgrades
  run just the specs of their own change. Thin wrapper over .claude/scripts/supervisor/push-git.mjs. Use when the owner
  says push, "push main", "run full tests then push", or runs /push-git.
user-invocable: true
---

# push-git

Everyday harness work never runs a whole suite (`config.yaml specs.harness`, default false = touching-only; the land
gate runs `--specs touching` and refuses `--specs all`; a code-writing op runs only the specs of the source it
changed). `/push-git` is where the whole suites run, once, right before a main leaves the machine, and it pushes only when
they are green. It decides nothing about any workflow and never stashes, resets or cleans anything.

Executable: `.claude/scripts/supervisor/push-git.mjs`.

## What it runs, per repository

Repositories: `.claude` plus every product repository a project binding names (`.workspaces/projects/*/work.json`)
that has commits ahead of `origin/main`; `--repo <path>` (repeatable) picks them explicitly and runs them even when
nothing is ahead.

1. The main checkout must be clean: on branch `main`, no tracked modification, no staged change (untracked files are
   only counted). If it is dirty, the run reports the dirty paths and stops for that repository.
2. The full suite, every step to a log file:
   - `.claude`: `npm test` and `npm run check`.
   - app: its managed scripts `npm run typecheck`, `npm run lint`, `npm test` (the be unit project only - e2e is
     manual-only and never run), every `npm run build:<side>` it declares (`build:be`, `build:fe`), and `canon-scan`.
     A managed script the app lacks is reported `absent`.
3. Red: the run prints the failures grouped by spec file (typecheck, lint and canon by file), exits 1 and STOPS - no
   push, no later repository.
4. Green: `push-mains.mjs` in its promised order - dry run (secret scan), pre-push hooks alone, then the push - and
   the pushed count. If main moved while the suite ran, the run is red (`main-moved`) and starts over.

## Steps

1. From the source host (the directory holding `.claude/`), start with the check that pushes nothing:

   ```
   starci supervisor push --check          # everything except the push
   starci supervisor push                  # the same, then push each green main
   starci supervisor push --repo <path> --json
   ```

   Exit 0 = every selected repository green (and pushed unless `--check`); 1 = red, dirty, off main, refused or main
   moved; 2 = bad arguments. A full suite takes many minutes: run it in the background and read the log paths it prints.

2. If a repository is dirty or off main: say which paths, and let their owner land or revert them. Never stash, reset
   or clean to make it pass.

3. If a suite is red, start one fixer agent per failing group (one spec file or one source file, exactly the groups the
   run printed), each an `orchestration worker-start` worker. A `.claude` fixer works in its own staged lane (made first with
   `starci supervisor workers stage --self --name <lane> --files <csv>`, which prints the path the worker
   starts in: `--worktree path:<staged path>`), writes or updates the specs of the code it repairs, runs only those specs and lands with
   `starci supervisor land --commit <sha> --lane <lane> --specs touching --json`. A product app's fix is
   a workflow op in the workflow's worktree: its green settle is a checkpoint on `wf-<workflowId>`, and the app's main
   moves only at the workflow's finish (full `gate.mjs`, merge guard, `review.verify`, rebase, fast-forward and push;
   `docs/workflow-kernel.md`). No fixer runs a full suite and none pushes. When the fixes have landed, run `/push-git`
   again from the top.

4. If the push is refused (secret scan, pre-push hook, remote), report the reason as printed; never retry with force
   or `--no-verify`.

5. Report to the owner in Vietnamese, from the printed result: one line "GREEN" or "RED" for the whole run, then per
   repository its verdict, the number of commits pushed, and for each red step the failing files with their first
   failing case (copy them, do not paraphrase), then what happens next (fixers spawned, or nothing to do).
   Say plainly that e2e was not run.

The run is printed JSON-only; no ledger table holds a full-suite run. The push itself is recorded by `push-mains`
in machine.sqlite `pushes`.
