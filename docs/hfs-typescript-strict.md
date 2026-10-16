Owner: knowledge/hfs/rules.yaml

# TypeScript strictness

## R22 TypeScript

R22 applies to both the lite and full editions. The TypeScript configuration at each managed side's root extends the HFS strict preset. Removing that inheritance or
lowering a strict compiler option produces `HFS_TS_STRICT` during the managed
configuration check. Restoring the strict configuration clears the finding.

The same law rejects type escapes in application TypeScript. Type assertions,
double casts, non-null assertions, and explicit `any` produce `FE_TYPE_ESCAPE`
through the frontend ESLint rules. Narrow values with runtime checks or express
their types directly so that the compiler can verify the code.

The managed-configuration proof exercises a lowered option and its repaired
configuration in both editions. The RuleTester proof executes each type-escape
rule with rejecting and accepting TypeScript examples in both editions.
