# identity.provision — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop.

## Job

Provision the identity one flow signs in as: create each alias's account at the identity provider the bound route's registry entry declares, set its password from the sealed credential resolved by name, prove the account signs in, and publish the record of names the flow folder keeps; or rotate the administrator custody the same provider stands on.

## Done when

Done when the flow's account exists at the declared provider and signs in with the sealed credential resolved by name, the `checks` prove the identity proof set with none absent or failed, the `uat-account` carries only names and is written into the flow folder beside the drafted flow document, and the `delta` records each account created against the route's entry; or, under mode rotation, bound by `identityRotation`, the `delta` proves the new credential works and the old one fails, and no account record is published.

Primary output: `uat-account`

## Inputs

`environment-readiness` (optional)

## Outputs

`platform-operation-receipt` `response/response.md`
`delta` `response/data/delta.json`
`checks` `response/data/checks.json`
`uat-account` `response/data/account.json` (optional)

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT`, `PROVISIONING_UNAVAILABLE`, `IDENTITY_UNPROVEN`
