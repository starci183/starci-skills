# model-catalog

Lane N of `1.0.0-alpha.2`. The owner's decision (2026-09-23): the model catalog is GPT‑6 Sol, GPT‑6 Luna
and Claude Opus 5.5, plus the providers that are not model-specific (Devin `swe-2-max`, Qwen). Removed:
`gpt-6-astra`, the Claude Fable pool and targets (`claude-fable`, `claude-fable-5-1`, the `fable-astra`
config pool), every `gpt-5.6-*` target and alias, and `claude-opus-5`.

## Practiced

Read-only CLI probes on the owner's machine, 2026-09-23. No session was started.

- `codex --version` → `codex-cli 0.155.1`.
- `codex --help` → `-m, --model <MODEL>`; `-c model_reasoning_effort=...` is the effort override.
- `codex debug models` ("Render the raw model catalog as JSON") — the read-only listing. Rows with
  `visibility: list`, as printed:

  | slug | display name | reasoning levels | default | context | input |
  | --- | --- | --- | --- | --- | --- |
  | `gpt-6-astra` | GPT-6-Astra | low … ultra | medium | 272000 | text, image |
  | `gpt-6-sol` | GPT-6-Sol | low … ultra | medium | 272000 | text, image |
  | `gpt-6-luna` | GPT-6-Luna | low … max | medium | 272000 | text, image |
  | `gpt-5.6-sol` | GPT-5.6-Sol | low … ultra | low | 272000 | text, image |
  | `gpt-5.6-terra` | GPT-5.6-Terra | low … ultra | medium | 272000 | text, image |
  | `gpt-5.6-luna` | GPT-5.6-Luna | low … max | medium | 272000 | text, image |
  | `gpt-5.5` | GPT-5.5 | low … xhigh | medium | 272000 | text, image |

  The CLI still lists the removed models; the catalog removal is the owner's routing decision, not a
  provider retirement.
- `~/.codex/config.toml` pins `model = "gpt-6-sol"`, `model_reasoning_effort = "xhigh"`.
- `claude --version` → `2.1.274 (Claude Code)`.
- `claude --help` → `--model <model>` accepts an alias (`fable`, `opus`, `sonnet`) or a full name;
  `--effort <level>` accepts `low, medium, high, xhigh, max`. The CLI has no model-listing command.

After the cut, with an empty owner root (`STARCI_OWNER_ROOT`) and then a tmp `config.yaml` copied from
`config.example.yaml`:

- `route-model --kind architecture.decide --plan --difficulty <d>` → chain `codex-agent > claude-agent` at
  every tier; codex-agent model `gpt-6-luna` (easy, medium), `gpt-6-sol` (hard, insane); claude-agent
  `claude-opus-5-5` everywhere.
- `route-model --kind code.refactor --plan --difficulty hard` → `claude-agent > devin-agent > codex-agent`,
  pick claude-agent (`claude-opus-5-5`), codex-agent `gpt-6-sol`.
- `route-model --kind model.manageWorkflow` (kernel route, tmp config) → order
  `config.yaml models.nonOperation.kernelManager → pools.sol-opus`, pick codex-agent.
- `route-model --kind backend.implement --difficulty hard` (op route, tmp config) → pick qwen-agent by the
  registry chain.
- `dispatch-op --op code.refactor --model gpt-5.6-sol|claude-fable --dry-run` → exit 1
  `no model profile <id>`; `--model gpt-6-sol|gpt-6-luna` → exit 0, packet `constraints.model` is the id.

## Observed

Ids, verified against assumed:

| id | status | evidence |
| --- | --- | --- |
| `gpt-6-sol` | verified | `codex debug models` slug, `visibility: list`; the owner's `~/.codex/config.toml` default |
| `gpt-6-luna` | verified | `codex debug models` slug, `visibility: list`; reasoning levels stop at `max` |
| `claude-opus-5-5` | assumed | the models overview page (below); the Claude CLI lists no models, so the first managed dispatch's model attestation proves it (comment in `modules/models/runtimes.yaml`) |

Prices — the catalog stores none; they live here only:

| model | input / MTok | output / MTok | source |
| --- | --- | --- | --- |
| GPT‑6 Sol | $2 | $10 | owner's message, 2026-09-23 |
| GPT‑6 Luna | $0.10 | $0.50 | owner's message, 2026-09-23 |
| Claude Opus 5.5 | $4 | $20 | https://platform.claude.com/docs/en/about-claude/models/overview, fetched 2026-09-23 |

The same page gives Claude Opus 5.5 a 1M-token context, 128K output tokens, adaptive thinking always on and
an API default effort of `medium`. StarCi sends the effort its own routing decides, so the API default applies
only when no effort is passed.

The only role-carrying runtimes left for `plan`, `decide` and `verify` together are codex-agent and
claude-agent. `engine/config.mjs` requires every configured pool to be a two-member canonical pair, so the two
old pools (`fable-astra`, `opus-sol`) collapse to one pool with both members; two pools with the same members
would be one fact stated twice.

## Derived

Catalog before → after (`modules/models/runtimes.yaml` `runtimes.<pool>.models`):

| pool | easy | medium | hard | insane |
| --- | --- | --- | --- | --- |
| codex-agent (before) | gpt-5.6-luna | gpt-5.6-luna | gpt-5.6-sol | gpt-6-astra |
| codex-agent (after) | gpt-6-luna | gpt-6-luna | gpt-6-sol | gpt-6-sol |
| claude-agent (before) | claude-opus-5 | claude-opus-5 | claude-opus-5 | claude-opus-5 |
| claude-agent (after) | claude-opus-5-5 | claude-opus-5-5 | claude-opus-5-5 | claude-opus-5-5 |
| claude-fable (before) | — | claude-fable-5-1 | claude-fable-5-1 | claude-fable-5-1 |
| claude-fable (after) | deleted | | | |
| qwen-agent, devin-agent | unchanged | | | |

- Decide/plan tiers and preferences, and every reasoning operator chain in `modules/models/registry.yaml`,
  lead with codex-agent then claude-agent; hard verify is `claude-agent > codex-agent > devin-agent`.
- Registry targets: `gpt-6-sol` and `gpt-6-luna` (launch-only, profiles added) replace `gpt-5.6-luna`;
  `claude-fable` is deleted with its profile. Aliases: `codex-gpt-6-sol`, `codex-gpt-6-luna`,
  `claude-opus-5-5`; every `gpt-5.6-*`, `gpt-6-astra` and `claude-fable*` alias is gone.
- Owner config: `kernel: {agent: codex, model: gpt-6-sol, effort: high}`; `models.pools` is
  `sol-opus: [codex-agent, claude-agent]` and all three `nonOperation` roles name it
  (`engine/config.mjs` `DEFAULT_MODEL_POOLS`). A config naming `fable-astra` is refused
  (`tests/config.spec.mjs`).
- The `fable`/`claude-fable` aliases are gone from `scripts/agent/bias.mjs`,
  `scripts/api/quota/index.mjs` and `scripts/kernel/api.mjs`.

## Open

- **Image generation on GPT‑6 Sol.** `profiles/gpt-6-sol.yaml` carries `imageGeneration: true`, moved from the
  5.6 Sol profile. It is unverified until the first `interface.draw` dispatch attests it.
- **Owner `config.yaml`** (`D:/Repositories/starci-academy-backend/.claude/config.yaml`, untracked) still
  names the removed pools and fails validation until the owner edits it: replace `models.pools` with
  `sol-opus: [codex-agent, claude-agent]` and set `models.nonOperation.planner`, `.kernelManager` and
  `.validator` to `sol-opus`. Its `kernel` pin (`devin`/`swe-2-max`) is unaffected; the `claude-opus-5`
  example in its kernel comment is stale text only. Checked in memory with `validateConfig`: the file also
  carries a top-level `supervisor: {pollIntervalMs: 600000}` that the validator refuses as an unknown key
  independently of this cut; with that key gone and the three pool edits made, it validates.
