Task: configure canonical runtime credentials for a selected action
# Host credentials

The canonical runtime root holds the owner's local `secret.env` and the tracked `secret.env.example`.
Use the example to create a missing local file, then fill the required names locally. The file stores
plaintext dotenv values; setup requires no encryption or decryption. Keep an existing file and its
contents. Secret values stay out of `config.yaml`, chat, command arguments, diagnostics, receipts and
repository history.

`engine/secrets.mjs` owns `SECRET_ENV_FILE`, `readDotenv` and `secretEnv(canonicalRuntimeRoot, env)`.
Native callers resolve the canonical runtime through `runtimeSecretEnv` in
`scripts/gates/runtime-host.mjs`; a routed project or linked worktree uses that same host root.
The root dotenv is merged below the supplied environment, including explicitly empty environment
values. Loading returns an environment without mutating `process.env`. The owner sets values locally;
an agent never reads or prints the file to guide setup.

## Secrets of the self-hosted Sonar stack

The product Sonar server of `ext/sonar` holds no secret in the repository. Its Compose files read the environment of the process that
runs them, and `starci gate sonar up [--public]` builds that environment from `secret.env` (`secretEnv`) and refuses, naming the
missing variable (`sonar-host-secret-missing`), before it starts anything. `sonar-local.mjs` reads the admin token from the same
resolved environment. The names, all in `secret.env.example`: `SONARQUBE_DB_PASSWORD`, `SONARQUBE_ADMIN_PASSWORD`,
`SONARQUBE_ADMIN_TOKEN` and `CLOUDFLARE_TUNNEL_TOKEN` (only with `--public`). Distinct from `SONAR_TOKEN`, the SonarCloud token.

The previous layout tracked sealed members of this stack; they are deleted, their ciphertext remains in git history. The owner moves each
value once with his own age identity: `starci runtime import-held-secret --member <old path> [--rev <rev>]` reads the member from git
history (without `--rev`, from the parent of the commit that deleted it), decrypts it through the sops call owner and appends
`NAME=value` to `secret.env` without printing it, and it never overwrites a name already there. The member table:

| Old member | Variable | Read by |
| --- | --- | --- |
| `ext/sonar/secrets/sonarqube-db-password.txt.enc` | `SONARQUBE_DB_PASSWORD` | `ext/sonar/compose.yaml`, through `starci gate sonar up` |
| `ext/sonar/secrets/sonarqube-admin-password.txt.enc` | `SONARQUBE_ADMIN_PASSWORD` | the bootstrap of `ext/sonar/compose.yaml` |
| `ext/sonar/secrets/sonarqube-admin-token.key.enc` | `SONARQUBE_ADMIN_TOKEN` | `scripts/gates/sonar-local.mjs` |
| `ext/sonar/secrets/cloudflare-starci-local-services-tunnel-token.key.enc` | `CLOUDFLARE_TUNNEL_TOKEN` | `ext/sonar/cloudflared.yaml`, through `starci gate sonar up --public` |
| `ext/sonar/secrets/sonarqube-analysis-token.txt.enc` | none (retired) | nothing reads a server-wide analysis token of the extension; a product reads its own custody |
| the two demo secrets of the ecommerce example | none (retired) | the example carries demo-only defaults in its compose files |

A ciphertext deleted from the tree stays in the public history, encrypted to the owner's age key: rotate the stack's admin password,
admin token and tunnel token after the move.

## Shared age identity

`engine/secrets.mjs` owns `sopsIdentityEnv`. The caller hands it the canonical normalized environment.
`SOPS_AGE_KEY` presence selects inline custody; an explicit blank or invalid value refuses fallback.
The SOPS API owns native inline invocation admission in `scripts/api/sops/lib.mjs`; the shared selector
continues to hold callers that have no invocation-bound proof. The API derives one native X25519 recipient,
admits a flat age envelope through `scripts/lib/sops-envelope.mjs`, and passes its exact bytes to SOPS
with the full document MAC enabled. Child context excludes additive age, SSH, command and remote-keyservice
sources without changing the parent environment. Unsupported tools, formats, providers, groups, partial MAC
and mismatched recipients refuse. This admission creates no identity and grants no provider-token mint.
Original cwd and SOPS_CONFIG formatting policy remain available; explicit one --age and removed provider
recipient inputs prevent config KeyGroups from adding a provider. Ciphertext is admitted and read back
before return. Native tools are required; only researched versions are admitted, update probing is disabled,
and the unsupported upstream fixed audit-file context refuses before spawn. Image headers and version
strings do not authenticate binaries: the owning native gate must qualify physical tools and real crypto.
An explicitly selected original `SOPS_AGE_KEY_FILE` remains a transition input when inline is absent;
an absent FILE is not replaced with a home default. The original FILE is selected by its absolute path so
caller and child working directories cannot silently select different files. Neither selection rewrites an existing identity.
Public-recipient encryption needs no newly generated private identity.

Initial identity capture and guarded publication belong to the setup owner and remain a separate dependency.
The commented template entry represents absence. Actual environment precedence, including intentional blanks,
continues to apply. Canonical-root handoff and fake fixtures prove routing only; native recipient, cryptographic,
filesystem-permission and publication-race verification require their own fresh evidence.

## Selected-action preflight

`scripts/cli/lib/credential-preflight.mjs` runs before a selected CLI action's protected effects.
`scripts/lib/credential-requirements.mjs` owns `credentialRequirements`. Explicit service selection,
normalized connector settings and presence-only declarations from the selected native action owner
determine required inputs. The selector returns presence-only requirements plus native account-managed
adapter metadata. Disabled connectors, unselected providers and unrelated actions impose no credentials.
Help and read-only inspection keep their read-only behavior.

If a required input is absent or empty, report the blocked action and exact missing names. An environment
requirement uses the local `secret.env` or supported environment/custody pointer. A file requirement
identifies the configured credential-file input; a configuration requirement identifies its owning field.
Show no secret value or file contents, and request no secret pasted into chat. The owner supplies the
missing input locally, then the same native action rechecks it within the unchanged approved scope.
A malformed-input diagnostic identifies the input without echoing its contents.

Native execution adapters retain their supported CLI account-auth route. When that route uses an
account login, preflight does not invent a mandatory API-key variable. The adapter's actual native
authentication, quota and launch checks still apply.

Credential presence proves availability only. Provider authentication, connectivity, account scope
and integration verification have their own native checks and evidence. A presence result, startup
receipt or supplied key never proves product completion.

## Entry and runtime roles

The single public `/starci` entry selects the requested StarCi instructions. Resolve an unclear
workflow's project, goal, scope and expected outcome, show the native draft and derived operation plan,
and obtain the owner's explicit acceptance before queue or launch effects. Credential presence grants
no approval. Reuse an existing acceptance while its goal, plan and authority remain unchanged.

Approved workflow startup owns host readiness and configuration-selected maintenance. The product
Kernel owns workflow operations and delivery. The cross-workflow Supervisor owns operational
coordination. Debug maintenance diagnoses StarCi runtime defects and routes repairs through qualified
lanes. A workflow monitor reads and relays its workflow. Local credential setup changes none of these
authorities or their model routes; it creates no additional loop, worker or scheduler.

Application secrets follow the selected application's stack and secret contract. Host credential setup
grants no authority to move, convert or overwrite those secrets.
