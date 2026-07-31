# Debt

Work that was **deliberately** left undone. Each file is one deferral: the files it lives in, the
rule it breaks, and — the part that matters — why it was not fixed.

These are not bugs and not a backlog. A bug is unintended; everything here was weighed and parked.
If you are about to work in an area and something looks wrong, look here first: the odd shape may
already have been considered.

```bash
node ../scripts/record-technical-debt.mjs list        # what is open
node ../scripts/record-technical-debt.mjs show <id>   # one entry
node ../scripts/record-technical-debt.mjs --check     # do the paths still exist
```

Paths inside an entry are relative to a **role** (`fe`, `be`, `design_system`, `claude`), never
absolute — which folder a role means is answered per machine by
[`starci-setup-workspace-fe`](../skills/starci-setup-workspace-fe/SKILL.md). That is what lets an
entry written on one machine still resolve on yours.

**A `## Why it was left` is an account, not proof.** It records what the person deferring believed
at the time, and nothing has checked it since. If one says a fix is blocked, confirm the block still
exists before repeating the conclusion — see
[`house-rules.md`](../max-pro-vip/references/house-rules.md) §2, *a comment is a claim, not
evidence*.

How to add one: [`skills/starci-record-debt/`](../skills/starci-record-debt/SKILL.md).
