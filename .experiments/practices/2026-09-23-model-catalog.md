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
