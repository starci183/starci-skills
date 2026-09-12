# Proof by contrast: a green check is not proof

`machineVerify` re-runs the checks an operation declares and refuses a `done` the kernel cannot reproduce.
That settles one thing only: the checks pass at the operation's head. It does not show the behavior changed.
An operation that writes `assert.equal(typeof double,'function')` and wires it into its check list is green
forever, on the old code as well as the new. The missing half of the proof is the contrast: the spec the
operation added must **fail before the change and pass after it**.

`execution/verify-proof.mjs` supplies that half. It never edits the operation's worktree, never commits, and
never checks anything out there.

## The plan

`proofPlan(op,{changedFiles})` reads the operation's real changed files (from `changedFiles`, which comes from
`git status --porcelain` filtered to the allowlist - never from `report.files`) and keeps the ones matching
`/\.(spec|test|e2e-spec|container-spec)\.[cm]?[jt]sx?$/`. Then it keeps the declared checks that actually run
one of those specs: the command names the path, or names the file, or the check's `scope` covers it.

The plan is `mode:'fail-before'` only when `PROOF_POLICY` asks for the contrast for this operation kind
(`backend.implement` and `interface.implement` today, everything else `checks-only`), there is at least one
changed spec, and some check runs it. Otherwise it is `mode:'checks-only'` with a `reason`, so a downgrade is
recorded rather than assumed.

## The base worktree

`runAtBase` builds the "before" out of git, not out of a stash:

1. `git worktree add --detach <tmp> <baseHead>` into a fresh `mkdtemp` directory, so the base is a real
   checkout of the commit the operation started from, beside the live worktree rather than inside it.
2. Only the changed **spec** files are copied into it - the new tests, the old code. Nothing else from the
   operation's work crosses over; a spec that no longer exists is recorded in `missing`.
3. The proof commands run there (cwd = the temporary worktree), then the same commands run in the operation's
   worktree at `opHead`. Each result carries `exitCode`, a `tail` of the output and `timedOut`; `timeoutMs`
   defaults to 20 minutes per command.
4. `git worktree remove --force` plus a prune in a `finally`, whatever happened above.

Paths are normalized with forward slashes and rejoined natively, so the same code drives Windows and POSIX.

## The verdicts

| verdict | what happened | what the kernel does |
| --- | --- | --- |
| `proven` | a proof command fails at base (not by timeout) and every command is green at head | accept the slice; the contrast belongs in the evidence manifest next to the re-run checks |
| `weak` | head is green but base is green too - the spec does not discriminate | accept, and carry `proofFinding(result)` into `open[]`/findings so a repair operation can sharpen the test. Not a hard failure |
| `contradiction` | a proof command fails at head | the slice is not done: the operation's own checks do not pass in its own worktree |
| `checks-only` | no changed spec, or a kind whose policy is `checks-only`, or no check runs the spec | `machineVerify` alone decides; nothing is run twice |

A base worktree that cannot be built is also `weak`, with `error` set: an unproven claim, never a silent pass.
A base command that only timed out does not count as a discriminating failure either - the contrast is
unknown, so the verdict stays `weak` and says why.

`proofFinding(result)` returns the single sentence for `open[]` - e.g. *the added spec `lib.spec.mjs` also
passes at base 5412ae012548: it does not prove the change* - and `null` for `proven` and `checks-only`.
