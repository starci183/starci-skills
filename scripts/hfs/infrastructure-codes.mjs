// infrastructure-codes.mjs - the failure codes of the HFS tooling itself, which no rule of knowledge/hfs/rules.yaml owns.
// A rule's failureCodes name what a PRODUCT violates; these name what the harness's own tools report about themselves: the
// rule catalog's parity check, the sync gate of a product's managed files, the source-language gate of the runtime and the
// work-hygiene gate. Together with the "cannot judge" refusals (REFUSAL_CODES of scripts/hfs/check.mjs, ERROR_RULE_IDS of the
// architecture machine) they are the only HFS_/ARCH_/BE_/FE_ codes of modules/kernel/failure-codes.yaml that is not a code of
// a rule (scripts/checks/check-hfs-rules.mjs, HFS_RULE_CODE_UNOWNED). Each entry names its emitter.
export const INFRASTRUCTURE_CODES = Object.freeze({
  // scripts/gates/hfs-sync.mjs: the managed files of a product against what the runtime would write
  HFS_SYNC_DRIFT: 'scripts/gates/hfs-sync.mjs',
  HFS_SYNC_HFS_INVALID: 'scripts/gates/hfs-sync.mjs',
  HFS_SYNC_PRESET_MISSING: 'scripts/gates/hfs-sync.mjs',
  HFS_SYNC_SONAR_KEY: 'scripts/gates/hfs-sync.mjs',
  HFS_SYNC_TEMPLATE_VARIABLE: 'scripts/gates/hfs-sync.mjs',
  HFS_SYNC_TEMPLATE_MISSING: 'scripts/gates/hfs-sync.mjs',
  HFS_SYNC_MANIFEST_MANAGED: 'scripts/gates/hfs-sync.mjs',
  // the tracked .starciwork files of a product (the same gate)
  HFS_WORK_AGENT_DATA: 'scripts/gates/hfs-sync.mjs',
  // scripts/checks/check-doc-language.mjs: the source-language gate of the runtime
  HFS_SOURCE_NOT_ENGLISH: 'scripts/checks/check-doc-language.mjs',
  // scripts/checks/check-hfs-rules.mjs: the parity of the rule catalog with its enforcers
  HFS_RULES_INVALID: 'scripts/checks/check-hfs-rules.mjs',
  HFS_RULE_NO_ENFORCER: 'scripts/checks/check-hfs-rules.mjs',
  HFS_RULE_ENFORCER_MISSING: 'scripts/checks/check-hfs-rules.mjs',
  HFS_RULE_ENFORCER_PLANNED: 'scripts/checks/check-hfs-rules.mjs',
  HFS_RULE_ENFORCER_STALE: 'scripts/checks/check-hfs-rules.mjs',
  HFS_RULE_CODE_UNEMITTED: 'scripts/checks/check-hfs-rules.mjs',
  HFS_RULE_UNCATALOGUED: 'scripts/checks/check-hfs-rules.mjs',
  HFS_RULE_UNTESTED: 'scripts/checks/check-hfs-rules.mjs',
  HFS_RULE_CODE_UNCATALOGUED: 'scripts/checks/check-hfs-rules.mjs',
  HFS_RULE_CODE_UNOWNED: 'scripts/checks/check-hfs-rules.mjs',
});
