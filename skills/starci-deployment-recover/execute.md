# Execute starci-deployment-recover

1. Accept only a validated global `selection` for this skill, validate the complete input, run local `analyze-input`, then enter fixed state `recover`.
2. Load only the current state's operator contract. That operator alone retrieves its declared Qdrant knowledge.
3. Validate operator input, execute it, validate output, then route through exactly one matching edge.
4. Keep selection, operator data, context, observations, plans and receipts in task-session memory only. On a loop, compare the prior fingerprint, reuse approved identities and reload only the re-entered operator. Block repeated no-progress fingerprints.
5. Wait states stop before irreversible work and accept only the displayed revision or command.
6. At every terminal, validate the result, return it, and purge all task-session intermediates. Preserve only approved product-source or external mutations.

## CONTEXT BY STATE

| State or phase | Allowed | Forbidden |
| --- | --- | --- |
| every state | current operator declaration only | undeclared context |

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@selection` | global `/analyze-input.md` output | task-session | prove why this one-flow skill was selected |
| `@machine` | `machine.json` | file | state, guard, branch, loop, wait and terminal ownership |
| `@input-analysis` | `analyze-input.md` | file | normalize this invocation before its fixed first state |

No Qdrant knowledge is loaded at skill scope.
