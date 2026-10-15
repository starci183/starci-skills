# Development stack

The app services may run in a local Docker Swarm; local Supabase is started separately with its CLI and supplies the database and broker. The tracked model contains no self-hosted database.
The application image references contain illustrative all-zero digests. Replace them with verified published release digests in the manifest, model and `.starcistacks/dev/infra/swarm/releases/images.lock.yaml` before starting the container model. Replace its starter `SUPABASE_URL` with the local Supabase endpoint reachable from the Swarm node, and seal that local database connection and integration credential; a container cannot use the host's loopback address without owner-configured networking. Local source development remains available through the app scripts.

The runtime template tracks no encrypted members. Scaffolding generates the two declared members with placeholder values encrypted to this app's own recipient in `.sops.yaml`. Replace those values with `starci app secret set dev` using the matching host age identity in untracked local custody. Existing generated envelopes are decryptable with that app identity and can be updated in place. Each Docker secret contains the corresponding key's real value, and the API receives it through its declared mounted file.

| Command | Operation |
| --- | --- |
| prepare | Run `npm run db:start` at the app root; obtain the local Supabase connection and Auth configuration. An owner who chooses local Swarm initializes it, labels its node `{{project}}=dev` and provisions the ingress volumes. Replace the reserved development host consistently in the manifest, Caddyfile and public configuration; resolve it to the node and record this in `.starcistacks/dev/infra/swarm/owner-actions.md`. Create the external development secrets named in the model from real sealed members. |
| doctor | From this directory, run `docker stack config -c infra/swarm/stack.yaml`. Confirm image, secret and local Supabase availability. |
| up | Run `docker stack deploy -c infra/swarm/stack.yaml {{project}}-dev` from this directory after preparation. |
| status | Run `docker stack services {{project}}-dev`. |
| logs | Run `docker service logs {{project}}-dev_api`; never print mounted credentials. |
| down | Run `docker stack rm {{project}}-dev`. |
| verification | Confirm the API `/health/live` and `/health/ready` endpoints and web `/health/live`, then run `npm run lint` from the app root. Retain the last accepted release in `.starcistacks/dev/infra/swarm/releases/previous.yaml` before recording the verified release in `.starcistacks/dev/infra/swarm/releases/current.yaml`. |

Keep real sealed members under `.starcistacks/dev/secrets/*.enc` at the declared paths and inventory their key names in `.starcistacks/dev/runtime/env/KEYS.md`. Rotation creates a new immutable `-v<N>` external secret and updates its version and runtime name together in the manifest and model. Only the declared ingress publishes port 80; the local route uses HTTP with automatic TLS disabled.

The manifest declares seven daily encrypted off-host database exports and ingress-volume snapshots owned by the development operator. `.starcistacks/dev/infra/swarm/recovery/restore-proof.md` is a pending recovery record. Complete an isolated restore and attach a dated receipt before relying on these backups. Release, DNS and restore records remain explicitly pending until an operator supplies real evidence.
