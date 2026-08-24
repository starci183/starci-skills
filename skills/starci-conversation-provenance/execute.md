# Execute starci-conversation-provenance

1. Validate input and run `analyze-input`; exactly one analysis edge must match.
2. Load only the selected state's operator contract. That operator alone retrieves its declared Qdrant knowledge.
3. Validate operator input, execute it, validate output, then route through exactly one matching edge.
4. Pass task-session references between states. Do not persist operator input, output, loaded context, observations, patch plans, or receipts to a run directory. On a loop, reuse approved identities and reload only the re-entered operator.
5. Wait states stop before irreversible work and accept only the displayed revision/command.
6. At every terminal state—including blocked, rejected, handoff, and not-needed—validate the final skill result, return the user-facing result, then purge all task-session intermediates. Preserve only explicitly approved product-source or external mutations.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@machine` | `machine.json` | file | state, guard, branch, loop, wait and terminal ownership |
| `@input-analysis` | `analyze-input.md` | file | classify the invocation before selecting an operator |

No Qdrant knowledge is loaded at skill scope.
