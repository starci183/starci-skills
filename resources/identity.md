# Identity operations

[identity.json](identity.json) owns the provider/custody binding and transport policy.
For provisioning, `scripts/identity-custody.mjs` checks the selected registry entry against the actual running
container, published port and mounted credential references before any value is resolved. A
same-named file in another repository is not an alternative credential source.

Administrator rotation follows the [platform identity contract](../operators/platform-operate/operator.md#requirements), including a captured bootstrap-environment binding when the provider does not mount credential files.

The operation runs inside a fixed helper with captured child-process pipes. It consumes decrypted
bytes directly into the intended provider or product request. The helper reports stage, status,
account identity and proof references only; raw provider bodies and process exceptions stay out of
the transcript. Redirects are refused and each request has a timeout. Credential-bearing commands
must never be replaced with a general file read, environment dump or diagnostic echo.

Provisioning follows the product's supported registration contract so that both the provider
identity and product account exist. Record uncertain mutation outcomes as uncertain and reconcile
the dedicated account before retrying. A successful account lookup is not sign-in evidence: verify
the product sign-in and then the browser session for the flow. An unavailable API is a runtime
finding to repair through the declared runtime ladder, not a reason to retry credentials.

Sources: [Owner repair evidence](../tests/evidence/20260904-owner-repair.md).
