# Connectors: public owner asks over Cloudflare + Telegram

An owner ask is a `serve-ask` form (`scripts/kernel/serve-ask.mjs`) on a random loopback port
`6969..7069` behind a bearer nonce path `/a-<hex>`. The connectors tell the owner the question exists
and, **only when the owner asks for it**, serve its form and make it reachable from the owner's phone
(owner, 2026-09-24: "1 link response.starci.org trỏ vào các question thôi, với lại khi yêu cầu thì mới
serve url! trò báo tele, tele có nút generate url thì mới serve. trả lời xong xóa"). Telegram carries owner asks, plus the media a settled
design or UAT op produced (drawings, UAT videos; the Media row below): no op progress, no
incidents, no finish messages. The one two-way path is the command bridge (below), where the owner
talks to a supervisor chat and it answers. They are configured by `config.yaml`
`connectors` (documented in `config.example.yaml`, validated fail-closed by `engine/config.mjs`) and
are all off by default.

```
kernel: api serve-ask -> serve-ask.mjs parkAsk -> telegram.mjs notifyAsk -> Telegram: question + [Generate URL]
                                                   (ledger: ask-notified; no form, no link)
owner presses [Generate URL] -> telegram-bridge.mjs (getUpdates callback_query ask:<key>)
     -> spawns serve-ask.mjs --on-demand telegram (ledger: ask-serving onDemand) -> waits for the bind
     -> tunnel.mjs ensureAskConnectors -> edits the SAME message: https://<public host>/a-<nonce>
                                          (credential ask: the localhost link, answer on the machine)
owner answers -> serve-ask.mjs: ask-answered, deletes the ask's messages (ask-message-closed), exits

     https://<public host>/a-<nonce>
Cloudflare edge -> cloudflared (tunnel.mjs) -> 127.0.0.1:<gateway.port> ask-gateway.mjs
                                                   -> 127.0.0.1:69xx/a-<nonce>  serve-ask form
```

| Piece | File | What it does |
| --- | --- | --- |
| Gateway | `scripts/connectors/ask-gateway.mjs` | One fixed local port. Proxies `/a-<nonce>` and `/a-<nonce>/...` (GET, HEAD, POST, redirects rewritten to paths) to the loopback form whose latest open `ask-serving` event carries that nonce and whose serve-ask process is alive, in the configured repos' ledgers plus every repo a Telegram notice named. Everything else is 404 and never forwarded (so the public host serves question forms and nothing else, and only while one is served); dot segments are refused; a non-loopback form URL is never a target. Adds `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`. |
| Tunnel | `scripts/connectors/tunnel.mjs` | Runs cloudflared at the gateway and restarts it when it dies (1 s doubling to 60 s). Always passes its own `--config` (written under the state dir), so `~/.cloudflared/config.yml` is never read. Records the public base URL in `tunnel.json`. `status` carries `health` (below). |
| Notifier | `scripts/connectors/telegram.mjs` | Called by the kernel's `api serve-ask` (`serve-ask.mjs parkAsk`): one message with the workflow, the question and its numbered options, in config `language`, and one inline button **Generate URL** ("Tạo link trả lời" in vi; `callback_data` `ask:<16 hex>`), with NO link. Deduped per ask while its notice is in the chat. `markAskClosed` deletes every message of an ask once it is answered, auto-accepted, retired or superseded (edited to "answered" only where Telegram refuses a delete, e.g. older than 48 h); `sweepAskMessages` is the bridge's reconciler. A missing token or chat id is a no-op with one stderr line; it never throws into its caller. Also `sweep`, `discover-chat` and `test`. |
| Media | `scripts/connectors/telegram-media.mjs` | Queued by the kernel's `api settle` (`cmdSettle` calls `queueSettleMedia`, which launches this file detached, so Telegram never slows or fails a settle; its stderr goes to `telegram-media.log`). An `interface.draw` / `interface.asset` settled pass sends its drawings as albums of up to 10 (the `draws[]` of the draws.yaml the report names, else the report's final images, else the ui record's `directionAsset`s) - always each drawing's part (page content, overlay panel, layout drawing), never the composite placed into the layout capture (`scripts/work/direction-part.mjs`) with one caption: what was drawn, screens, variants, states, the summary, "review at handover". A `uat.verify` / `uat.assisted.*` / `e2e.verify` settle sends every recorded video (any verdict) captioned with the verdict (ĐẠT / KHÔNG ĐẠT) and the flow's steps from its uat record; a pass with no video sends its screenshots. Images over 10 MB and videos over 50 MB are named by local path instead. Deduped per workflow, job and attempt. |

Repositories read: `connectors.repos`, or by default the source root plus every
`.workspaces/projects/*/work.json` Work owner that holds `.starciwork/runtime.sqlite`. The connectors
open ledgers with `inspectLedger` (read-only) and never write one.

State lives beside the machine arbiter: `%LOCALAPPDATA%/StarCi/runtime/connectors/`
(`gateway.json`, `tunnel.json`, `cloudflared.yml`, `cloudflared.log`, `telegram-sent.json`,
`telegram-media-sent.json`, `telegram-media.log`). `telegram-sent.json` (`starci/telegram-sent@2`)
keeps per ask `{key, repo, ledgerFile, workflowId, dispatchId, messageIds[], url, closed?}` and
`keys{<button key>: <workflow>|<dispatch>}`.

The gateway and the tunnel manager are single-instance per host (18 tunnel managers once ran at once,
all started by code from before the lock). Each `run` first claims `gateway.lock` / `tunnel.lock` in
that directory with an exclusive create and refuses (exit 1, at once) while another live manager holds
the lock or owns `gateway.json` / `tunnel.json`. A running tunnel manager re-checks every 30 s
(`STARCI_TUNNEL_OWNER_CHECK_MS`) that the lock still names it: when another live process holds it, it
stops its cloudflared (leaving `tunnel.json` to the owner) and exits; when the lock vanished it takes
it back. A starter (`start`, `ensureAskConnectors`, `resume-all.mjs`) never launches while a
manager is alive, and records `<name>.starting.json` so a launch still claiming its lock counts as
alive for 30 s. A recorded pid counts as live only if that process started in the current boot, so
after a reboot a stale record never blocks a fresh start.

## Owner asks on demand

1. **Park.** The kernel's `api serve-ask --workflow <id> --dispatch <id>` runs `parkAsk`: earlier asks
   it replaces are superseded and their messages deleted, then the owner gets the question with the
   **Generate URL** button, and the ledger gets `ask-notified {dispatchId, onDemand:true, via:telegram,
   messageId, key, fresh, fields}`. No form runs. `api status` reads such an ask as `awaiting-owner`
   (`frontier.askOnDemandDispatches`), not `ask-reserve`; the supervisor digest tags it `on-demand`.
   With Telegram off (or a failed send, `ask-notify-failed`) `api serve-ask` serves the form at once,
   as before; `--now` does that on purpose while still sending the notice.
2. **Generate URL.** The bridge answers the callback, launches `serve-ask.mjs --repo <r> --workflow <w>
   --dispatch <d> --on-demand telegram` detached (it hides its children's windows) unless the ask's form
   already serves, waits for the bind (`ask-serving` with `onDemand:true, requestedBy:telegram`), runs
   `ensureAskConnectors` and waits for the tunnel's public base, then edits the pressed message to carry
   `https://<hostname>/a-<nonce>` and its expiry. A credential ask gets the localhost link and "answer
   on the machine" instead and never touches the tunnel (`exposeCredentialAsks` opts in). The button
   stays: after the form expires (4 h) or its process dies, pressing it serves a new one.
3. **/asks** lists every open ask of the connector repos (plus every repo a notice named), one message
   each with its own button; a form that already serves shows its link. Those messages are deleted with
   the ask too.
4. **Answer.** serve-ask records `ask-answered`, deletes the ask's messages (`ask-message-closed`) and
   exits, so the gateway stops routing the nonce. `api retire-ask`, auto-accept and a superseding ask
   delete them the same way. Every poll round (at most once a minute) the bridge sweeps the store: the
   messages of an ask that closed by any path (including forms started before this runtime) are
   deleted, and a message still linking to a form that ended goes back to the button notice.

Migration: forms served before this change keep serving and keep their old messages; the next bridge
run lists them in /asks (a press reuses the live form), and the sweep deletes their messages once they
are answered.

## Health and restart

`node scripts/connectors/tunnel.mjs status` prints `health`: `manager {pid, alive, lockPid}`,
`cloudflared {pid, alive, connected, restarts, lastExit}`, `gateway {pid, alive, port, reachable,
status}` (a GET of `/` on the gateway port; nothing answering there is why the public host returns 502),
`managers` (every `tunnel.mjs run` process on the host; `--fast` skips the process listing),
`healthy` and `problems[]`. To restart: `tunnel.mjs stop` and `ask-gateway.mjs stop` (kill any extra
manager `managers` lists), then `ask-gateway.mjs start` and `tunnel.mjs start`, and check `status`
again.

## Commands

```
node scripts/connectors/ask-gateway.mjs start        # detached; status | stop | run (foreground)
node scripts/connectors/tunnel.mjs dry-run           # print the cloudflared argv + generated config
node scripts/connectors/tunnel.mjs start             # detached manager; status | stop | run
node scripts/connectors/telegram.mjs discover-chat   # after sending the bot /start: chat ids
node scripts/connectors/telegram.mjs test            # one test message to connectors.telegram.chatId
node scripts/connectors/telegram.mjs notify --ledger <repo>/.starciwork/runtime.sqlite --workflow <id> --dispatch <id> [--repo <repo>]
                                                     # (re-)send one open ask's notice (deduped while it is in the chat)
node scripts/connectors/telegram.mjs sweep           # delete the messages of closed asks, drop dead links
node scripts/connectors/telegram-media.mjs settle --ledger <file> --repo <repo> --workflow <id> --job <id> --attempt <n> --op <op> --verdict <v> [--dispatch <id>]
                                                     # send one settled op's media (deduped; what settle launches)
```

## Command bridge: the owner talks to a supervisor over Telegram

`scripts/connectors/telegram-bridge.mjs` lets the owner command a supervisor chat by messaging the
bot. Several supervisors may be registered at once; buttons pick which one the owner talks to.

```
owner (Telegram) -> getUpdates long poll -> telegram-bridge.mjs -> <state>/supervisors/<id>.inbox.jsonl
                                                                        |
supervisor chat  <- channel.mjs wait / inbox  <-------------------------+
supervisor chat  -> channel.mjs reply -> sendMessage "[<label>] ..." -> owner (Telegram)
```

- **One poller per host.** The bridge claims `telegram-bridge.lock` (the same single-manager lock as
  the gateway and tunnel) and records `telegram-bridge.json` `{pid, startedAt, offset}`. It long-polls
  `getUpdates` (50 s, `message` + `callback_query`) and stores the next offset *before* handling an
  update, so a restart never delivers a message twice. A `409 Conflict` exits when another bridge holds
  the lock, else backs off; network and 5xx errors back off 1 s doubling to 60 s; a refused token
  (401/403/404) or Telegram turning off stops it. Logs: `telegram-bridge.log`, numeric ids only.
- **Hard auth.** An update is accepted only when its chat id AND its sender id both equal
  `connectors.telegram.chatId` (the owner's private chat). Anything else is dropped unanswered and
  logged by numeric id; message text is never logged.
- **Commands** (English): `/start` and `/choose` show one button per registered supervisor, 🟢 online
  (heartbeat within 30 minutes) or ⚪ offline, ✓ on the current one; `/status` sends the progress report
  (`progress-report.mjs` builder) from the bridge itself, so it works with no supervisor; `/asks` lists
  the open owner asks, each with its Generate URL button ("Owner asks on demand" above); `/help`. The
  bot's replies follow config.yaml `language` (vi, else en).
- **Routing.** A pick is stored per chat in `telegram-route.json`. Plain text goes to the routed
  supervisor's inbox as `{id, at, chatId, messageId, text, read:false}` and is acknowledged as a reply
  ("📥 Đã chuyển cho <label>.", plus an offline note when its heartbeat is stale). With no route, a
  lone registered supervisor is picked automatically; otherwise the message is held (up to 20) and
  the chooser shown, and the held messages are delivered once the owner picks.
- **Registry.** `<state>/supervisors/<id>.json` `{id, label, repos, registeredAt, heartbeatAt}`.
- **Lifecycle.** `channel.mjs register` / `heartbeat` start the bridge when none runs
  (`ensureTelegramBridge`); `resume-all.mjs` (the every-10-minutes task) does the same once any
  supervisor has registered, so the bridge survives a reboot. Telegram off or a spec run is a no-op.
- **Stall alerts.** `resume-all.mjs` also launches `scripts/supervisor/stall-alert.mjs` detached each
  pass. Each finding of `scripts/supervisor/stall.mjs` goes to whoever can fix it:

  | Finding | Route | Delivery |
  |---|---|---|
  | STALE-GATE, STALE-WAIT, STALE-PEER-WAIT; UNREAD-PEER past the 10-min grace; STALLED that is actionable, on a stale gate/wait, or unexplained; an owner-gate its own text calls a peer dependency | owning Kernel | one `[stall]` wake per workflow into its Kernel terminal (proven delivery, `scripts/kernel/wake-delivery.mjs`) with the evidence and the exact `api` action; a `stall-wake` event on the workflow; a busy Kernel or a worker mid-turn is retried next pass; one wake per finding per 20 min |
  | the same finding 20 min after its first delivered wake; a Kernel unable to take a wake for 20 min; never woken in 60 min; STALLED with an unreadable frontier or behind a gate only a peer can release | supervisor | supervisor `main`'s inbox as `STALL-ALERT <n> finding(s) the workflows could not fix themselves: <line> [why]` (chatId and messageId null, so `wait` fires with no owner message behind it); at most once per finding per hour |
  | a justified owner gate past its grace waiting on an open owner ask or naming nothing checkable; STALLED on frontier `awaiting-owner` | owner | ONE Telegram digest in `language` at most every 60 min: per workflow what waits on the owner and since when, and `/asks`; an unchanged digest is repeated at most every 4 h |
  | PEER-WAIT, a young gate, a gate waiting on a record a peer owes, STALLED parked on justified peer-waits | none | printed only |

  No STALE-*, UNREAD-PEER or actionable STALLED is ever sent to the owner's Telegram by this check;
  forwarding a runtime escalation to the owner is the supervisor's call. Dedupe state:
  `<state>/stall-alerts.json` (`starci/stall-alerts@2`).

```
node scripts/supervisor/channel.mjs register --id <id> --label <text> [--repos <csv>]
node scripts/supervisor/channel.mjs heartbeat --id <id>
node scripts/supervisor/channel.mjs inbox --id <id> [--json] [--peek]     # unread; marks read unless --peek
node scripts/supervisor/channel.mjs reply --id <id> (--text <t> | --text-file <f>) [--to <inboxMessageId>]
node scripts/supervisor/channel.mjs wait --id <id> [--timeout-ms <n>]     # "TELEGRAM <inboxId>: <text>", exit 0; 124 on timeout
node scripts/connectors/telegram-bridge.mjs start | run | status | stop
```

What a supervisor may do on a chat message is `modules/supervisor/supervise.yaml` `channel`: the
owner's request within the supervisor's delegated scope; anything irreversible, outward,
credential-bearing or a handover approval still needs the owner at the machine. Security: the chat is a
Telegram cloud chat (not end-to-end encrypted) and anyone holding the owner's Telegram account can
command the supervisors, within that same scope.

## Where secrets live

- Never in `config.yaml`. `tokenEnv` / `botTokenEnv` must be an UPPER_SNAKE env var **name**; a pasted
  token, or a `token`/`botToken`/`secret` key, is refused by validation.
- The value comes from the process environment, or `<NAME>_FILE` pointing at a custody file, or the
  gitignored dotenv file `connectors.secretsFile` (default `.secrets/connectors.env`, relative to the
  skill root; `/.secrets/` is in `.gitignore`). A real env var wins over the file.
- A named tunnel with `tunnel` + `credentialsFile` uses the credentials JSON `cloudflared tunnel create`
  wrote (`~/.cloudflared/<uuid>.json`); a remotely managed tunnel token is handed to cloudflared as
  `TUNNEL_TOKEN` in the child environment, never on argv.
- `connectorsConfig()` reports only `tokenPresent` / `botTokenPresent` / `credentialsPresent`
  booleans. The notifier scrubs the token from every error it records or prints.

## Security critique

- **The link is a bearer credential posted to Telegram.** Anyone holding `https://<host>/a-<nonce>` can
  open the form and answer it. Telegram cloud chats are not end-to-end encrypted: Telegram's servers,
  anyone with access to the owner's Telegram account or its linked devices, and anyone the message is
  forwarded to hold the link — and the question text itself, which may name business decisions. The
  nonce is 72 random bits, so it cannot be guessed, but it can be read.
  Mitigations here: a link exists only after the owner pressed Generate URL (nothing is served before),
  link previews are disabled (Telegram does not fetch the URL), the gateway sets
  `no-referrer`/`no-store`, the form is one-shot (serve-ask exits after one answer; a second POST is 409)
  and expires with its ttl (4 h by default), and the message carrying the link is deleted once answered.
- **Quick tunnels are unauthenticated and ephemeral.** A `trycloudflare.com` host has no account, no
  access control and no SLA, and changes on every restart, which kills every link already sent. Use it
  for yes/no decisions only; the named tunnel's fixed hostname does not have this problem.
- **Recommend a named tunnel + Cloudflare Access** for anything beyond decisions: put an Access
  application (e.g. one-time PIN to the owner's email) in front of the hostname so the nonce is no
  longer the only credential, then set `cloudflare.access: true`. Without it, a warning is printed.
- **Credential asks stay local by default.** An ask whose form requests custody files or env values is
  not linked publicly (the message carries the localhost link and says to answer on the machine), and
  the gateway answers 403 for it even if someone has the nonce. `telegram.exposeCredentialAsks: true`
  opts in; it is warned about, because the secret would then cross Cloudflare's edge (TLS-terminated
  there) as well as the public link.
- **What the gateway exposes.** Only paths under a currently open nonce; the form's evidence images
  are served under that nonce, so an approval ask about screenshots makes those screenshots public to
  the link holder. The form accepts an `answered_by` field for delegation; a link holder could claim a
  delegate identity while a delegation is active, which is one more reason to front the hostname with
  Access.
- **The machine side.** The gateway binds 127.0.0.1 only; cloudflared makes outbound connections
  only. The Telegram bot token can send messages as the bot and read its updates; keep it in the
  gitignored secrets file or the environment, and revoke it with BotFather if it leaks.
