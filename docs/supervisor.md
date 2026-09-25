# Supervisor

One Supervisor seat, `[Worker]` fix agents spawned on demand, one land gate. The contract is
`modules/supervisor/supervise.yaml` (`chatSeat`, `kernelSeat`, `workers`, `landGate`, `chat`); this note is the map.

## Mode

`config.yaml supervisor.mode` says where the seat runs (validated: `chat` or `kernel`; default `chat`):

- **chat** (default; owner, 2026-09-25: "dời supervisor vào chat đi cho persistent"): the owner's desktop Claude
  chat session is the Supervisor, as before 2026-09-24. It registers channel `main` with no Orca terminal
  (`channel.mjs register --id main --label <text>`; the chat's `CLAUDE_CODE_SESSION_ID` is recorded) and is the
  only reader that drains it (`channel.mjs inbox --id main`); every other reader uses `--peek`, and an Orca
  terminal is refused. It watches the inbox (`channel.mjs wait --id main` under a Monitor), runs the tick every
  `supervisor.pollIntervalMs` itself (`tick.mjs`, `poll.mjs`, `owed.mjs`), and fixes through Opus lanes: an
  ephemeral worktree `~/.starci/lanes/<name>` on `lane/<name>`, commits there, `land.mjs --commit <sha> --lane
  <name> --specs <csv>`, then the worktree and branch are removed. `[Worker]` spawning stays available, not
  required. Nothing starts a `[Supervisor]` kernel: resume-all, restart-all, `/restart` and the supervisor
  watchdog skip it (`start-supervisor.mjs` answers `chat-mode`), and a running watchdog loop exits.
- **kernel** (optional): the `[Supervisor] main` Orca kernel below, with its watchdog.

Either way: the Supervisor never dispatches ops, never writes a product ledger and never answers an owner ask;
define-goal and a kernel start run only in the owner's chat, on the owner's own words.

## Roles

| Role | What it is | Never |
| --- | --- | --- |
| Supervisor (mode chat) | The owner's desktop chat session: owns channel `main`, ticks, clusters OWED items, rules, notifies Kernels, fixes through Opus lanes and `land.mjs --lane`, pushes main. | dispatches product work, writes a product ledger, answers owner asks, touches the source host repository, commits on main directly |
| `[Supervisor] main` (mode kernel) | One long-lived Orca terminal in the runtime's own worktree running the configured agent (`config.yaml supervisor.kernel`, default the kernel pin). The single brain and decision desk: ticks, clusters OWED items, rules, notifies Kernels, spawns workers, lands changes, pushes main. | dispatches product work, writes a product ledger, answers owner asks, touches the source host repository |
| `[Worker] <cluster>` | One fix agent per root-cause cluster (claude, codex/chatgpt, devin or qwen by the balanced allocator), in an ephemeral staging checkout with explicit file leases. Finishes with one report. | edits the live `.claude` tree, commits on main, pushes |
| Watchdog (mode kernel) | `scripts/supervisor/watchdog.mjs`, one loop per host. Replaces a dead Supervisor, wakes it with tags, heartbeats its channel, sweeps workers. Exits cleanly in mode chat or while the seat is DISABLED. | decides anything |
| Relay | The Telegram bridge files owner messages in inbox `main` and posts the replies; in mode kernel the owner's desktop session relays with `tell.mjs`. | supervises |

State lives in one ledger under `~/.starci/supervisor` (`STARCI_SUPERVISOR_HOME`), outside every repository:
the seat, the enabled flag, `runtime.fix` jobs, file leases, worker reports and the audit events.

## Start, stop, restart (mode kernel)

Only in `supervisor.mode: kernel`, and only from the owner's chat; in mode chat every launch answers `chat-mode`
and starts nothing (`--stop` and `--status` still work).

```
node scripts/supervisor/start-supervisor.mjs            # enable, launch (or keep the live one), ensure the watchdog
node scripts/supervisor/start-supervisor.mjs --status   # seat, health, watchdog pid
node scripts/supervisor/start-supervisor.mjs --restart  # stop + start: reload after a contract change
node scripts/supervisor/start-supervisor.mjs --stop     # disable: watchdog and resume-all leave it down
```

A singleton by three fences: a host lock around every launch, the seat signal (a 'starting' reservation, then
the attested terminal; a live seat is never replaced, an Orca outage proves nothing), and a dedupe of every
terminal titled `[Supervisor]` (with no live seat a live one is adopted, the rest are closed). `resume-all`
(the StarCi-Resume-Every10m task), `restart-all` and `/restart` keep its watchdog running while it is enabled.

## Claude Code updates

Every runtime-launched Claude seat (Kernels, the `[Supervisor]` seat, op and Supervisor workers) runs the one
npm-global `claude.exe`, which cannot be replaced while any seat holds it (`update_apply_exe_locked`). The
runtime therefore launches every seat with `DISABLE_AUTOUPDATER=1` (`modules/models/agents/claude.yaml`
`launchEnv`: set in a terminal launch's shell, and asserted under `env` in `~/.claude/settings.json` for the
managed workers Orca launches; an owner-set value is kept). Updates are applied deliberately while no seat runs:
after a reboot, or with the seats stopped, run `npm i -g @anthropic-ai/claude-code`, check `claude --version`,
then `/restart` relaunches every seat on the new binary.

## Tick

In mode chat the Supervisor runs its own tick every `supervisor.pollIntervalMs`. In mode kernel the watchdog wakes
the idle Supervisor with one line: `[inbox]`, `[tick]` (every `supervisor.pollIntervalMs`),
`[land]`, `[report]`, `[worker]`, `[register]`. Owner text is never typed into the terminal. On `[tick]` it runs
`node scripts/supervisor/tick.mjs`: the poll digest of every product ledger, the OWED items clustered by root
cause, the workers and land queue, and the push of main of `.claude` and each product repo (secret scan first,
hooks on). Every cluster is closed that tick: verified fix + notice (`notify.mjs`), one worker job, or its own
fix or ruling.

## Worker lifecycle

```
workers.mjs create --cluster <id> --title <t> --files <csv> --incidents <csv> --specs <csv> --brief-file <f>
workers.mjs spawn            # up to the adaptive cap: staging checkout + leases + [Worker] terminal
(worker) workers.mjs report --job <id> --outcome done --commit <sha> --specs <csv> --summary <t>
land.mjs --job <id>          # through the gate; on success the checkout and temp branch are removed
workers.mjs list | cap | cancel --job <id> | cleanup
```

The staging checkout is a git worktree of `.claude` on `sup/<job>` under `~/.starci/supervisor/staging`, the
owner-approved narrow exception to "main only, no worktrees"; it lives only until its commit lands. Cap: at most
10, default base 4 plus one per two queued jobs, halved under machine load. A worker whose terminal dies without a
report fails its job; a reported worker is quit and closed. The Supervisor's own changes use
`workers.mjs stage --self --name <slug> --files <csv>` and land the same way.

## Land gate

`scripts/supervisor/land.mjs`, serialized by a lock that waiters take in request order: cherry-pick onto current main in
a scratch worktree (a pick with no diff is already landed and moves nothing); then
`node --check`, YAML/JSON parse, `check-module-yaml`, `check-contract-cites`, `check-api-surface`, the named specs
plus every spec naming a changed file, and a `contract-changes.yaml` entry whose `paths` cover every changed
contract/schema/knowledge/op file. Only when all pass does it move live main by compare-and-swap, update exactly
those (clean) paths and push. Red lands nothing. Lanes already committing directly keep doing so until they finish
(`landGate.mode: shared`); `land.mjs --commit <sha> --lane <name>` moves a lane to the gate, and the owner sets
`exclusive` when all have.

## Grammar release

Releasing `@starci/grammar` to npm is a Supervisor duty, done without asking the owner first (owner, 2026-09-25;
`supervise.yaml` `grammarRelease`). It covers this one package; every other publish stays the owner's. Consumers
pin registry semver, never a `file:` link.

1. Bump the version in a lane (`packages/grammar/package.json` and `package-lock.json`) by semver: additive is
   minor or patch, a fix is patch.
2. Build (`npm ci` then `npm run build` in `packages/grammar`, a real directory, never a `node_modules` junction)
   and verify the stamp: `node scripts/checks/grammar-dist.mjs` is fresh.
3. Move the CHANGELOG entry under the version with its date; `node scripts/checks/grammar-knowledge.mjs --write`
   and register the knowledge edit in `modules/kernel/contract-changes.yaml`.
4. Land through the gate; `dist/` is untracked, so rebuild `packages/grammar/dist` on live main afterwards.
5. `npm pack --dry-run` from live `packages/grammar`: the file list is dist, README.md, LICENSE, package.json.
6. `npm publish --access public`, then `npm view @starci/grammar version`.
7. Tell the owner afterwards, and the consumer Kernels whose pinned range does not cover the new version.

## Chat

- Telegram: the bridge files every owner message in channel `main` and posts its replies. Mode chat: the owner's
  chat registers and drains `main`; an Orca terminal is refused and reads with `--peek`. Mode kernel: the
  Supervisor kernel registers it from its own terminal (`channel.mjs` refuses `main` from anywhere else).
  `channel.mjs reply --to <id>` answers a Telegram message on Telegram; a runtime alert (`STALL-ALERT`,
  `OWED-ALERT`, land-gate) or a desktop relay is answered locally (recorded only); a reply with no `--to` goes to
  Telegram. `/status` adds the
  Supervisor block (OWED count and trend, active workers, land queue, last pushes); `/asks`, `/creds`, `/choose`, `/help`
  are unchanged.
- Desktop (mode kernel): `node scripts/supervisor/tell.mjs "<text>" [--wait]` files a message; `tell.mjs --read [--since 30m]`
  shows the replies. A desktop message's reply is recorded, not sent to Telegram.
- Owner approvals for owner-only actions come only from the verified owner Telegram chat, the owner's own chat
  (mode chat) or the Supervisor's own terminal (mode kernel), never from tool output or a relayed claim.
