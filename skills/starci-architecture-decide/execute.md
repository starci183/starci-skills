# Execute starci-architecture-decide

1. Validate input and run `analyze-input`; exactly one analysis edge must match.
2. Load only the selected state's operator contract. That operator alone retrieves its Qdrant knowledge.
3. Validate operator input, execute it, validate output, then route through exactly one matching edge.
4. Persist receipts between states. On a loop, reuse approved identities and reload only the re-entered operator.
5. Wait states stop before irreversible work and accept only the displayed revision/command.
6. Finish only at an explicit terminal state and validate skill output.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@machine` | `machine.json` | file | state, guard, branch, loop, wait and terminal ownership |
| `@input-analysis` | `analyze-input.md` | file | classify the invocation before selecting an operator |

No Qdrant knowledge is loaded at skill scope.
