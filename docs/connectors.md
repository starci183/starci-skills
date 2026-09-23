# Connectors: public owner asks over Cloudflare + Telegram

An owner ask is a `serve-ask` form (`scripts/kernel/serve-ask.mjs`) on a random loopback port
`6969..7069` behind a bearer nonce path `/a-<hex>`. The connectors make that form reachable from the
owner's phone and tell the owner it exists. Telegram carries owner asks, plus the media a settled
design or UAT op produced (drawings, UAT videos; the Media row below): no op progress, no
incidents, no finish messages. The one two-way path is the command bridge (below), where the owner
talks to a supervisor chat and it answers. They are configured by `config.yaml`
`connectors` (documented in `config.example.yaml`, validated fail-closed by `engine/config.mjs`) and
are all off by default.

```
Telegram chat  <- telegram.mjs notifyAsk (Bot API sendMessage) <- serve-ask.mjs, when the form binds
     |
     v  https://<public host>/a-<nonce>
Cloudflare edge -> cloudflared (tunnel.mjs) -> 127.0.0.1:<gateway.port> ask-gateway.mjs
                                                   -> 127.0.0.1:69xx/a-<nonce>  serve-ask form
```

| Piece | File | What it does |
| --- | --- | --- |
| Gateway | `scripts/connectors/ask-gateway.mjs` | One fixed local port. Proxies `/a-<nonce>` and `/a-<nonce>/...` (GET, HEAD, POST, redirects rewritten to paths) to the loopback form whose latest open `ask-serving` event carries that nonce, in the configured repos' ledgers. Everything else is 404 and never forwarded; dot segments are refused; a non-loopback form URL is never a target. Adds `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`. |
| Tunnel | `scripts/connectors/tunnel.mjs` | Runs cloudflared at the gateway and restarts it when it dies (1 s doubling to 60 s). Always passes its own `--config` (written under the state dir), so `~/.cloudflared/config.yml` is never read. Records the public base URL in `tunnel.json`. |
| Notifier | `scripts/connectors/telegram.mjs` | Called once by `serve-ask.mjs` when a form binds (the kernel's `api serve-ask` path): one message with the workflow, the question, its numbered options, the link `https://<hostname>/a-<nonce>` and the expiry, in config `language`. Deduped per `ask-serving` event; a re-served ask sends its new link ("link mới") and edits the earlier message to point at it. A missing token or chat id is a no-op with one stderr line; it never throws into serve-ask. Also `discover-chat` and `test`. |
| Media | `scripts/connectors/telegram-media.mjs` | Queued by the kernel's `api settle` (`cmdSettle` calls `queueSettleMedia`, which launches this file detached, so Telegram never slows or fails a settle; its stderr goes to `telegram-media.log`). An `interface.draw` / `interface.asset` settled pass sends its drawings as albums of up to 10 (the `draws[]` of the draws.yaml the report names, else the report's final images, else the ui record's `directionAsset`s) with one caption: what was drawn, screens, variants, states, the summary, "review at handover". A `uat.verify` / `uat.assisted.*` / `e2e.verify` settle sends every recorded video (any verdict) captioned with the verdict (ĐẠT / KHÔNG ĐẠT) and the flow's steps from its uat record; a pass with no video sends its screenshots. Images over 10 MB and videos over 50 MB are named by local path instead. Deduped per workflow, job and attempt. |

Repositories read: `connectors.repos`, or by default the source root plus every
`.workspaces/projects/*/work.json` Work owner that holds `.starciwork/runtime.sqlite`. The connectors
open ledgers with `inspectLedger` (read-only) and never write one.

State lives beside the machine arbiter: `%LOCALAPPDATA%/StarCi/runtime/connectors/`
(`gateway.json`, `tunnel.json`, `cloudflared.yml`, `cloudflared.log`, `telegram-sent.json`,
`telegram-media-sent.json`, `telegram-media.log`).

The gateway and the tunnel manager are single-instance per host. `start` is called by every
serve-ask, often at once, so each `run` first claims `gateway.lock` / `tunnel.lock` in that
directory with an exclusive create and refuses while another live manager holds the lock or owns
`gateway.json` / `tunnel.json`. A recorded pid counts as live only if that process started in the
current boot, so after a reboot a stale record never blocks a fresh start.

## Commands

```
node scripts/connectors/ask-gateway.mjs start        # detached; status | stop | run (foreground)
node scripts/connectors/tunnel.mjs dry-run           # print the cloudflared argv + generated config
node scripts/connectors/tunnel.mjs start             # detached manager; status | stop | run
node scripts/connectors/telegram.mjs discover-chat   # after sending the bot /start: chat ids
node scripts/connectors/telegram.mjs test            # one test message to connectors.telegram.chatId
node scripts/connectors/telegram.mjs notify --ledger <repo>/.starciwork/runtime.sqlite --workflow <id> --dispatch <id>
                                                     # re-send one served ask (deduped)
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
  (`progress-report.mjs` builder) from the bridge itself, so it works with no supervisor; `/help`. The
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
  Mitigations here: link previews are disabled (Telegram does not fetch the URL), the gateway sets
  `no-referrer`/`no-store`, the form is one-shot (serve-ask exits after one answer; a second POST is 409)
  and expires with its ttl (4 h by default).
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
