# chat-launcher-orca-kernel

## Practiced

- Defined and queued a real public-frontend workflow from a human chat, then
  previewed and attempted its Kernel boot through `start-workflow.mjs`.
- Exercised a configured Codex / `gpt-5.6-sol` Kernel identity against the
  Orca host path from a chat that was not itself an Orca coordinator terminal.
- Reproduced boot behavior with typed fake-Orca receipts for terminal and
  orchestration calls, including an unavailable configured agent and a
  requested/effective model mismatch.

## Observed

- When `model.manageWorkflow` found no eligible target, the old launcher path
  silently selected Devin (`routedBy: fallback`) even though the owner expected
  the Kernel to be Codex on `gpt-5.6-sol`.
- Treating a native Codex Kernel as an orchestration worker made boot call
  `run-create` from a plain chat. Orca rejected it with
  `no_active_sender_terminal` / missing launcher context, so no Kernel terminal
  was established.
- The `run-create` wrapper previously lost a JSON error when stderr was empty.
  That diagnostic defect had already received a narrow patch; it exposed the
  topology error but did not make run creation valid at Kernel boot.
- `provider` was used for a human chat surface, an execution adapter, a routing
  profile and a quota pool. This allowed a valid model profile
  (`codex-agent`) to be mistaken for either an agent id (`codex`) or a concrete
  model id (`gpt-5.6-sol`).
- The Codex card still described `--full-auto`, while the installed CLI exposes
  explicit `--model`, `-c model_reasoning_effort=...`,
  `--ask-for-approval never` and `--sandbox danger-full-access` arguments.
- A real managed Codex operation was started successfully and then rejected at
  a second `orchestration dispatch` call. `worker-start` already owns Task
  dispatch/injection; dispatching the same Task again is not delivery proof.
- Orca exposes worktree lineage, Task parents and pane ancestry, but a worker
  in the Kernel's worktree may render as a peer tab. Titles and `parentPaneKey`
  therefore cannot be the durable Kernel-to-Op relationship.

## Derived

- Canonical topology is now documented in
  `modules/kernel/start-workflow.yaml` and the `start-kernel` / `workflow-chat`
  skills: a Codex/Claude/Devin human chat is the launcher, Orca is the host,
  the Kernel is one dedicated Orca terminal, and operation agents retain their
  separately routed worker lifecycle.
- Canonical names are recorded in `modules/models/index.yaml`: `launcher`,
  `host`, `agent`, `model`, `profile`, and `runtimePool`. `provider` survives
  only as a compatibility alias for `agent` in older routing data.
- Kernel boot does not create an orchestration run. It performs terminal
  create/read/send/activity attestation and persists the terminal handle.
  Operations may create/reuse Orca runs later through `api dispatch`.
- An explicit Kernel agent/model pin fails closed when unavailable. Only
  operation routing may follow its declared fallback chain.
- A requested model is accepted only after the ready terminal renders the
  exact model id. The command flag proves a request, not the effective model.
- Codex command composition is card-owned through `modelArgs`, `effortArgs`
  and `bypassArgs`; launchers do not reconstruct CLI syntax.
- `starci/agent-hierarchy@1` is the runtime projection: stable workflow,
  Kernel and operation-job nodes carry Orca Run/Task/Dispatch/terminal
  metadata. `api hierarchy` renders it without parsing terminal titles.
- One lazy Orca Run belongs to the workflow and names the dedicated Kernel
  terminal as coordinator. Managed Op launch ends at `worker-start` plus
  read-only attestation; command-terminal Op launch creates the same Task and
  binds its exact terminal with `dispatch --return-preamble`.

## Open

- Real-host evidence is still required after the regression suite passes:
  boot one queued workflow, verify the returned Orca terminal is writable and
  visibly reports `gpt-5.6-sol`, then confirm the first operation dispatch
  creates/uses its own run without changing the Kernel terminal identity.
- Orca's desktop sidebar does not yet consume `starci/agent-hierarchy@1`; the
  contract now supplies the exact tree an Orca renderer can join to its live
  Run/Task/Dispatch state.
- The legacy `kernel.provider` config key and `--provider` CLI option need a
  versioned migration before their compatibility aliases can be removed.
