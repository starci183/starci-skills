# Provider execution contracts

This tree is the only provider-call authority for StarCi execution. Prompts select a provider and fill declared placeholders; they do not invent APIs, flags, agent forms or lifecycle shortcuts.

```text
providers/
├─ catalog.yaml                 # host-mode router and contract references
├─ validate.mjs                # executable fail-closed cross-contract validation
├─ common/
│  └─ envelopes.yaml           # normalized operation/workflow I/O
├─ orca/
│  ├─ index.yaml               # role hierarchy and exact construction forms
│  ├─ capabilities.yaml        # supported host modes and limits
│  ├─ api.yaml                 # complete observed public command inventory + role allowlists
│  ├─ recipes.yaml             # valid orchestration call sequences
│  ├─ validation.yaml          # live discovery, receipts and UI assertions
│  └─ adapters/
│     ├─ codex.yaml            # Orca-native Codex adapter
│     ├─ claude.yaml           # Orca-native Claude adapter
│     └─ qwen.yaml             # prewarm-and-attach Qwen adapter with nested agents disabled
├─ codex/
│  ├─ index.yaml               # Codex solo and Orca-managed forms
│  ├─ capabilities.yaml        # mode/capability limits
│  ├─ api.yaml                 # complete injected collaboration API contract
│  ├─ recipes.yaml             # valid solo/bootstrap sequences
│  └─ validation.yaml          # preflight and receipt checks
└─ claude/
   ├─ index.yaml               # Claude solo and Orca-managed forms
   ├─ capabilities.yaml        # mode/capability limits
   ├─ api.yaml                 # verified Task subagent contract
   ├─ recipes.yaml             # valid solo/bootstrap sequences
   └─ validation.yaml          # preflight and receipt checks
```

Orca command names are snapshotted completely in `orca/api.yaml`. Command signatures remain live-runtime facts: resolve the selected entry from `orca agent-context --json` immediately before effects and fail closed on mismatch. Codex and Claude likewise require the active injected tool schema before a call.

