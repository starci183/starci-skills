---
title: OAuth
runtime: true
source: en.md
sourceHash: 03e116cf7aca8ddb364bfc8ed2dec3a2df6a93327043e0ab99ee8bcf35161b22
contextVersion: 1
---

# OAuth: Keycloak, Google and GitHub

## LOADS

None.

## Use when

Use this page when a local or deployed environment needs Google/GitHub sign-in through Keycloak, when
an OAuth client rotates, or when login fails with redirect/state/client errors.

## Before

Start the local stack and confirm Keycloak and the API are reachable:

```powershell
npm run compose
npm run start:dev
Invoke-WebRequest http://localhost:8081/realms/master
```

Local facts derived by the repository are:

- Keycloak: `http://localhost:8081`, realm `master`, client `academy-web`.
- API Google callback: `http://localhost:3001/api/v1/keycloak/google/callback`.
- API GitHub broker callback: `http://localhost:3001/api/v1/keycloak/github/callback`.
- Direct GitHub account-link callback: `http://localhost:3001/api/v1/github/oauth/callback`.

Production must replace host/scheme with the public HTTPS endpoints; path, case and trailing slash must
match exactly.

## Secrets

Google's client secret belongs in the Keycloak identity-provider configuration, not source. GitHub's
direct OAuth secret is stored as `github-secret-key.key.enc`; the Keycloak GitHub broker secret belongs
in Keycloak. Never put a client secret in `app.env`, README or an OAuth URL.

## Run

### Keycloak client

Open `http://localhost:8081/admin`, sign in with the generated admin credential, select realm `master`,
and create/configure client `academy-web`:

- Client type: OpenID Connect.
- Standard flow: enabled.
- Valid redirect URIs: the two API Keycloak callbacks above.
- Web origins: the frontend development origin, exact scheme/host/port.
- PKCE: S256 where the client setting is available.

### Google provider

1. In Google Cloud create/select a project and configure the OAuth consent screen.
2. Create an OAuth client of type **Web application**.
3. Add the Keycloak broker endpoint as an authorized redirect URI:

   `http://localhost:8081/realms/master/broker/google/endpoint`

4. In Keycloak: `Identity providers` → `Google`; enter the Google client ID/secret and enable it.
5. Ensure alias is exactly `google`, matching `kc_idp_hint=google` in source.

### GitHub provider

1. Create a GitHub OAuth App for the environment.
2. For the Keycloak broker app, use callback:

   `http://localhost:8081/realms/master/broker/github/endpoint`

3. In Keycloak: `Identity providers` → `GitHub`; enter the app client ID/secret and keep alias `github`.
4. If direct GitHub account linking is used, create/configure its OAuth App with callback
   `http://localhost:3001/api/v1/github/oauth/callback`; store its secret:

```powershell
npm run secret:set -- dev/runtime/files/github-secret-key.key
npm run sync
```

Set non-secret client IDs/redirect overrides through the environment-specific encrypted app config,
not by editing defaults in `config.ts`.

## Verify

1. Open the API's Google redirect endpoint with the frontend `redirect_uri` parameter.
2. Browser must move API → Keycloak → Google → Keycloak broker endpoint → API callback.
3. The callback returns application tokens and creates/updates one local user with Google auth type.
4. Repeat for GitHub; verify the GitHub username is recorded where returned.
5. Inspect API/Keycloak logs for state expiration, client or redirect errors; do not log authorization codes.

## Stop or rollback

Disable the Keycloak identity provider to stop new logins without deleting linked users. Re-enable the
previous OAuth client/secret before revoking a replacement that failed verification.

## Rotate

Create a replacement client secret, update Keycloak or the encrypted direct-GitHub record, restart/sync,
complete one login, then revoke the old secret. A redirect-domain change updates Google/GitHub provider,
Keycloak client redirects, app callback variables and frontend origin in one release.

## Troubleshoot

| Symptom | First check |
|---|---|
| Google `redirect_uri_mismatch` | Google URI must be the Keycloak `/broker/google/endpoint`, exact character-for-character |
| Keycloak `Client not found` | realm/client ID and retained Keycloak volume |
| callback returns invalid code | API callback registered in Keycloak client and same redirect used for token exchange |
| state expired/missing | restart from the redirect endpoint; do not reuse an old callback URL |
| provider selection screen appears | IdP alias must match `google` or `github` |
| production login loops to localhost | environment callback overrides were not published |

## Upstream

- [Google OAuth web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Keycloak identity brokering](https://www.keycloak.org/docs/latest/server_admin/#_identity_broker)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
