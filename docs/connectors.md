# Connectors: public owner asks over Cloudflare + Telegram

An owner ask is a `serve-ask` form (`scripts/kernel/serve-ask.mjs`) on a random loopback port
`6969..7069` behind a bearer nonce path `/a-<hex>`. The connectors make that form reachable from the
owner's phone and tell the owner it exists. Telegram carries owner asks only: no op progress, no
incidents, no finish messages, and the supervisor never sends. They are configured by `config.yaml`
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

Repositories read: `connectors.repos`, or by default the source root plus every
`.workspaces/projects/*/work.json` Work owner that holds `.starciwork/runtime.sqlite`. The connectors
open ledgers with `inspectLedger` (read-only) and never write one.

State lives beside the machine arbiter: `%LOCALAPPDATA%/StarCi/runtime/connectors/`
(`gateway.json`, `tunnel.json`, `cloudflared.yml`, `cloudflared.log`, `telegram-sent.json`).

## Commands

```
node scripts/connectors/ask-gateway.mjs start        # detached; status | stop | run (foreground)
node scripts/connectors/tunnel.mjs dry-run           # print the cloudflared argv + generated config
node scripts/connectors/tunnel.mjs start             # detached manager; status | stop | run
node scripts/connectors/telegram.mjs discover-chat   # after sending the bot /start: chat ids
node scripts/connectors/telegram.mjs test            # one test message to connectors.telegram.chatId
node scripts/connectors/telegram.mjs notify --ledger <repo>/.starciwork/runtime.sqlite --workflow <id> --dispatch <id>
                                                     # re-send one served ask (deduped)
```

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
