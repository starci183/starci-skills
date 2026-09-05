# identity.provision — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback.

## Done when

Done when the flow's account exists at the declared provider and signs in with the sealed credential resolved by name, the `checks` prove the identity proof set with none absent or failed, the `uat-account` carries only names and is written into the flow folder beside the drafted flow document, and the `delta` records each account created against the route's entry; or, under mode rotation, bound by `identityRotation`, the `delta` proves the new credential works and the old one fails, and no account record is published.

Primary output: `uat-account`

## Inputs

`environment-readiness`?

## Outputs

`platform-operation-receipt` `response/response.md`
`delta` `response/data/delta.json`
`checks` `response/data/checks.json`
`uat-account` `response/data/account.json`?

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT`, `PROVISIONING_UNAVAILABLE`, `IDENTITY_UNPROVEN`
