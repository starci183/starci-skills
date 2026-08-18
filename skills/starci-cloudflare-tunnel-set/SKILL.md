---
name: starci-cloudflare-tunnel-set
description: Manage the multi-project Source Cloudflare control plane by encrypting its API credential under Source workspace credentials and reconciling remotely managed HTTP tunnel/DNS routes. Use when a routed workspace service needs an idempotent public hostname; not for connector runtime, databases or raw TCP exposure.
---

# starci-cloudflare-tunnel-set

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | shared approval and output contract |
| `@initialization` | `readiness/initialization` | module | owns Source identity and routed workspace readiness |

## NESTED SKILLS

None.

## Run

Read `@skill-shape`, then `@initialization`. Resolve the Source-wide language and the declared project and
role. This skill consumes initialization state; it never creates or replaces the master identity and never
repairs a route.

Run the helper in plan mode first:

```text
node .claude/scripts/cloudflare-tunnel-set.mjs --project <project> --role <role> --zone <zone> --hostname <hostname> --service <http-origin> --tunnel <name> --plan
```

The plan must resolve the requested route, the existing `~/.starci/master.identity`, the encrypted
workspace credential records, and the exact external tunnel, ingress and DNS boundary. A missing or
ambiguous value stops before credentials are requested.

## Approval boundary

Creating or changing a tunnel, ingress, DNS record, or encrypted credential is an external/product write.
Display the helper's value-free plan under `### NEED APPROVALS`; only `OK` authorizes those exact targets.
Run the same command without `--plan` to reconcile the declared route.

The helper reuses `.workspace/credentials/cloudflare-api-token.key.enc` through the initialized SOPS identity
when the record exists. Otherwise it reads `CLOUDFLARE_API_TOKEN` from its process environment or asks through
a hidden interactive prompt. The value is never accepted in chat, a command argument or a plaintext config
file, and is never printed. It
encrypts credentials directly under the machine-local Source workspace:

- `.workspace/credentials/cloudflare-api-token.key.enc`
- `.workspace/credentials/cloudflare-<tunnel>-tunnel-token.key.enc`

The first record authorizes reconciliation. The second is namespaced by the normalized tunnel name and
holds the run token returned for that tunnel, so two tunnels never overwrite one credential owner.
Both are encrypted to the identity established by initialization. This is one Source-wide control plane
shared by every declared project; `project/role` proves the requested origin route but does not scope the
Cloudflare account credential. Connector execution is deliberately outside this skill. A product stack may
own its connector config and stack-scoped run-token custody without becoming the control plane.

## Reconciliation

Use one remotely managed (`config_src: cloudflare`) named tunnel. Reuse it by exact name or create it once.
Merge the requested hostname into existing ingress without deleting other hostnames, keep one terminal
`http_status:404` rule, and change configuration only when its value differs. Create or update one proxied
CNAME to `<tunnel-id>.cfargotunnel.com`. Refuse an existing conflicting record rather than replacing it.

Only `http://` and `https://` origins are admitted. Credentials in an origin URL, raw TCP schemes, known
datastore/admin ports and datastore host identities are refused. An exception needs a separately accepted,
exact exposure policy; this skill does not improvise or bypass one.

## Proof

Success names only whether tunnel, ingress and DNS were created, updated, reused or unchanged; it never
includes account tokens, tunnel run tokens or API response bodies. Confirm both encrypted record paths exist
and plaintext twins do not. The helper's offline proof is:

```text
node .claude/scripts/cloudflare-tunnel-set.mjs --self-test
```

The self-test uses a mock transport and makes no external call.

## Stops

- initialization identity absent or invalid → return to the initialization owner;
- route absent or stale → stop before reading a credential;
- Cloudflare access lacks active-zone read, Tunnel Write, or DNS Write → report missing access without
  retrying or widening permissions;
- origin violates the HTTP exposure policy or DNS conflicts → refuse the mutation;
- encryption fails → do not call the Cloudflare API; token retrieval encryption failure leaves external
  state reported as incomplete and never prints the token.

## Output

State the routed project/role, public hostname, private HTTP origin, tunnel name, encrypted record paths,
external change verdicts and proof. Never output credential values.
