Owner: modules/cli/commands/provision/operation.yaml

# Provider operations

Each managed task has an executable provider adapter and a catalogued StarCi command. The catalog's
action policy selects its stable operation id, effect, minimum credential roles, output destination
and applicable owner checkpoints. The dispatcher passes that selected policy to the operation owner;
the provider adapter validates its own configuration and cannot substitute another action.

The application declares named targets in `operations.targets` of its stack declaration, governed by
`modules/schemas/provision-operation.schema.yaml`. Each target names its provider, environment
context, auth-free origin, public resource configuration and credential roles. Its project comes
from the bound application's repository declaration. A target id is used instead of a URL carrying
credentials. HTTP providers keep an explicit origin; native `app-stack` and `app-db` targets declare
a closed `endpoint` instead. Local Supabase ownership and protected-port rules still apply.

| Credential purpose | Meaning |
| --- | --- |
| Provider administration | The account permitted to configure the selected provider resource |
| Source | The value the provider must receive, resolved privately from existing custody |
| Destination | The declared encrypted member that receives a provider-issued value |

Credential entries use the existing service credential contract. Their ids become role names;
`custody` names the repository and path, and `key` selects a structured encrypted member. These
references are public. The values remain private to the fixed execution owner. SonarCloud and a
self-hosted Sonar instance have separate targets and custody; an administrator credential never
fills a missing analysis or browse role.
A self-hosted Sonar admin role may explicitly select `hostConnection: sonar-selfhost-admin` through
the existing native host owner. This fixed bridge supplies no Cloud, analysis or Browse fallback.
After authority is established, the native custody owner can project its configured AGE material
privately for the selected application's encrypted member.

Run the provider command without `--execute` to prepare its immutable plan. Use the same
`--operation` id to inspect, accept, execute or reconcile it:

```sh
starci supabase cloud smtp-set --target hosted-auth --operation smtp-config
starci provision operation plan --operation smtp-config
starci provision operation accept --operation smtp-config --digest <plan-sha>
starci supabase cloud smtp-set --target hosted-auth --operation smtp-config --execute
starci provision operation status --operation smtp-config
```

Acceptance resolves the native trusted owner channel and binds the exact stored plan. A role,
reference or `--execute` flag alone does not authorize cloud changes. Changing the target,
configuration, credential references or destination changes the plan. Standalone operations use
the project's existing ledger and blob store without creating a workflow.

A native goal may include `--provision-grants <public-json-file>`. Its typed grant list references
prepared operation ids and digests, each assigned to one derived op. The existing goal plan shows
these grants for the owner's single acceptance; revisions bind them in their native approval
token. The provider execution owner rechecks the filed attempt, dispatch, op and current accepted
goal revision. It does not infer provider authority from goal wording. An omitted grant list on
a revision retains the prior list; an explicit empty list revokes it. Changed or revoked grants
require fresh admission. Authority is checked again at execution checkpoints; this is an admission
boundary rather than atomic revocation of an external request already in progress.

The current command families configure Supabase Cloud SMTP and Auth providers, ensure projects,
capture declared API keys, manage Sonar projects/settings/local users/tokens, run analysis, read
processed evidence and invoke application-owned workspace access commands. Supabase `secret-set`
addresses the Edge Functions secret store and requires an existing declared Edge Function consumer.
It does not select another cloud secret store by inference.

Sonar `user ensure` inspects an active account without creating or reactivating one. The provider's
user creation API can reactivate an inactive account, so StarCi exposes that effect explicitly as
`user create-or-reactivate`. Its target action and accepted plan must include possible reactivation
and password replacement. An absent account under plain `ensure` returns the provider limitation;
using the UI does not supply an atomic create-only primitive. A selected Browse credential names
its use; a user token still inherits its principal's permissions.

Application workspace ensure authenticates its existing owner before business writes. A plan that
includes first owner creation carries `--bootstrap-owner` explicitly. This input describes the
effect and grants no authority by itself. Reconciliation performs authenticated readback and
private session cleanup without repeating account or membership mutations.

`sonar project ensure` also ensures the project's quality gate when its target resource declares
`qualityGate`: the name must be the gate `knowledge/sonar-gate.yaml` gives the app's edition, the gate
is created when absent (organization-scoped on SonarQube Cloud), its conditions are made exactly that
file's server conditions, and it is selected for the project. The result is verified only by the gate
and project readback (`sonar-gate-readback`); a reconcile repeats no write.

`sonar release gate` runs the native application release gate with the target's separate analysis
and Browse roles. Its accepted plan includes native release records and local tag effects. It
waits for processed Sonar evidence for the exact revision; remote publication remains with the
existing release owner. This configured flow currently supports self-hosted Server and Community
targets with a required Sonar service declaration and explicit bounded timeouts. The application's
installed HFS must support this separate credential boundary before it can consume custody. The
ordinary application gate remains available under its own contract.

`access ci secret-set` binds the GitHub principal, source credential, repository, declared store
and secret name. The existing application CI owner checks its declaration and sealed-secret guard
before source custody opens; the value reaches that owner through private stdin. A write
acknowledgement plus public name readback does not prove value equality or consumer execution.

`access registry login` authenticates the declared GHCR principal into the selected native Docker
credential helper. It uses the fixed registry, public configuration identity and private
`registry-password` role from the accepted plan. The declared `dockerEndpoint` must be a local IPC
socket or Windows named pipe; the adapter explicitly selects it instead of an ambient Docker
context. Existing identical helper custody is reused;
conflicting or uncertain state remains held. Reconciliation reads the existing outcome without
replaying login. The stack's existing registry consumer uses that same native helper.
Helper reuse establishes local custody; it does not establish registry availability or a successful
image pull. The adapter requires helper listing to distinguish an empty entry from uncertain state
and never falls back to credentials stored in Docker's configuration file.

`access stack deploy|verify` and `access database migrate|inspect` invoke the existing application
owners. Their accepted plans freeze the application revision and effective endpoint. Stack targets
name the environment, stack and declared SSH target. Database targets select local, linked or
URL-env mode with its exact project or public URL key and endpoint identity. URL-env credentials
come from the declared `database-url` role. Public declaration checks precede custody; the native
owner compares the effective private SSH account or URL after resolution and before connecting.
The installed native CLI receives a public `--target-binding` assertion, which constrains its target
and grants no authority. Existing locks and safeguards remain authoritative. Migration still
requires the existing owner-controlled database arming step. These commands do not set arming,
reset a database, tear down a stack or invoke post-cutover actions. Reconciliation inspects prior
outcomes without replaying a deployment or migration. Stack health alone cannot establish an exact
deployment when its original result was lost. Configured stack verification may run commands or
mutating HTTP checks; those remain explicit accepted effects. Reconciliation stays held before
private setup when repeating those checks could write.

The operation owner records write acknowledgement, public-field readback and consumer behavior
separately. A masked secret readback establishes no value equality. Sonar scanner completion,
processed revision, quality gate and issue count are separate results. Workspace account creation
does not prove login and permissions for every role.

An uncertain remote write remains held for `--reconcile`; replaying a request id does not establish
remote exactly-once behavior. Provider-issued one-time output and encrypted custody outcomes remain
separate, including a successful mint followed by a custody failure. The runner retains the
operation's public receipt and never prints provider bodies, credentials or private child output.

Human interaction is reserved for actual provider or authority checkpoints: consent, MFA, CAPTCHA,
account ownership, billing, private initial input or output the provider cannot return again. A
missing adapter is an implementation gap. StarCi prepares the executable path and verifies its
result before describing the task as complete.

Provider references read on 2026-10-19:

| Adapter | Primary source and applicable boundary |
| --- | --- |
| Supabase SMTP and OAuth configuration | [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and [Auth configuration API](https://supabase.com/docs/reference/api/v1-update-auth-service-config): the management credential configures the selected project's Auth service; SMTP source credentials remain distinct. |
| Supabase cloud secrets | [Bulk create secrets](https://supabase.com/docs/reference/api/v1-bulk-create-secrets): the endpoint requires the Edge Functions secrets write permission; its acknowledgement does not establish another secret destination. |
| Application Auth identities | [Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser) and [listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers): admin calls stay server-side; listing is paginated and confirmation is an explicit creation input. |
| Application acting principal | [signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword) and [getUser](https://supabase.com/docs/reference/javascript/auth-getuser): the application authenticates private credentials or verifies a token with the provider before selecting its actor. |
| Sonar Server and Community | [Server API](https://docs.sonarsource.com/sonarqube-server/extension-guide/web-api), [Community API](https://docs.sonarsource.com/sonarqube-community-build/extension-guide/web-api), [token lifecycle](https://docs.sonarsource.com/sonarqube-server/user-guide/managing-tokens) and [user creation](https://docs.sonarsource.com/sonarqube-server/instance-administration/user-management/creating-users): capability and account permissions are checked for the selected instance; one-time token output must reach custody. |
| Sonar Cloud | [Cloud API](https://docs.sonarsource.com/sonarqube-cloud/appendices/web-api) and [Cloud tokens](https://docs.sonarsource.com/sonarqube-cloud/managing-your-account/managing-tokens): the Cloud account and organization remain separate from a self-hosted instance. |
| Sonar user and token effects | [User API source](https://raw.githubusercontent.com/SonarSource/sonarqube/master/server/sonar-webserver-webapi-v2/src/main/java/org/sonar/server/v2/api/user/controller/UserController.java) documents reactivation on create; [token generation source](https://raw.githubusercontent.com/SonarSource/sonarqube/master/server/sonar-webserver-webapi/src/main/java/org/sonar/server/usertoken/ws/GenerateAction.java) returns the issued token's name, type, login and applicable project key for verification before custody. |
| GitHub CI secrets | [GitHub CLI secret set](https://cli.github.com/manual/gh_secret_set) and [repository secret API](https://docs.github.com/en/rest/actions/secrets#create-or-update-a-repository-secret): select the declared repository, environment or Dependabot store; use authenticated encrypted transport without exposing the source value. |
| GHCR native registry custody | [Docker login](https://docs.docker.com/reference/cli/docker/login/), [native helper protocol](https://github.com/docker/docker-credential-helpers) and [GitHub Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry): send the credential through stdin to the fixed registry and use the configured native helper; local helper readback is distinct from provider or image-consumer verification. [Docker login source](https://raw.githubusercontent.com/docker/cli/master/cli/command/registry/login.go) sends login credentials to the selected daemon before a client-side fallback, so its local IPC endpoint is explicit in the plan. |

Live verification under separately supplied authority must check scoped cloud field readback, the
actual consumer of secret configuration, preserved existing accounts on rerun, and authenticated
owner/manager/staff behavior in the selected workspace. Source checks and fixture runs establish
none of those live results.
