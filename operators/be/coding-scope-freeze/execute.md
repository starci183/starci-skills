# Execute `be/coding-scope-freeze`

## Step 1 — Validate and freeze

**Read:** complete input envelope. **Context:** none. Validate and freeze without resolving bindings. **Session write:** validated input ref. **Stop:** invalid or foreign task input.

## Step 2 — Resolve session authority

Resolve the exact prerequisite and approved boundary from task-session state.

## Step 3 — Verify source identity

Compare repository HEAD with the approved baseline.

## Step 4 — Hash declared targets

For each declared target, calculate existence/hash through a deterministic hash-only reader. Never place bytes or text in model, worker, Qdrant, logs, output or scratch context.

## Step 5 — Freeze the boundary

Verify target-set hash, repository-relative paths, operations and allowed changes.

## Step 6 — Validate output and cleanup

Emit and validate one typed result; register all scratch metadata for terminal purge.

**Context:** no source body or undeclared binding is allowed. **Session write:** output, hash observations and evidence refs only. **Stop:** invalid or partially joined output. Orchestration is deterministic and sequential; no model or worker receives source bytes.
