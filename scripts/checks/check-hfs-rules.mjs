#!/usr/bin/env node
// check-hfs-rules.mjs - holds knowledge/hfs/rules.yaml (the 67 HFS rules) to what exists (part of `npm run check`).
//   node scripts/checks/check-hfs-rules.mjs [--json] [--unbuilt]
//
// The catalog is loaded through scripts/lib/hfs-slots.mjs (loadRuleCatalog), which refuses a catalog that breaks its schema
// (HFS_RULES_INVALID). On top of that this check refuses:
//   - a rule with no enforcer, or a `lint`/`check` kind with no enforcer of that family        HFS_RULE_NO_ENFORCER
//   - an existing eslint-be / eslint-fe enforcer whose id is not a rule of the plugin in packages/eslint/{be,fe},
//     or an existing machine / hfs / work-validate / sonar enforcer whose file (`at`) is missing or emits none of the
//     rule's codes                                                                            HFS_RULE_ENFORCER_MISSING
//   - a `status: planned` eslint enforcer the plugin already ships (drop the status)          HFS_RULE_ENFORCER_STALE
//   - a failure code with no entry in modules/kernel/failure-codes.yaml, or an entry lacking a Vietnamese
//     title_vi, meaning_vi or nextStep_vi                                                     HFS_RULE_CODE_UNCATALOGUED
// A planned enforcer is not a finding: it is the owed work, listed by --unbuilt (the rules with no existing enforcer at
// all) and counted in the summary. The lanes of the architecture machine, the hfs CLI, stylelint and Sonar fill them.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { HfsSlotsError, loadRuleCatalog, loadSlotManifest } from '../lib/hfs-slots.mjs';
import { isMain } from './common.mjs';

export const FAILURE_CODES_FILE = 'modules/kernel/failure-codes.yaml';
export const PLUGIN_ENTRY = Object.freeze({ 'eslint-be': 'packages/eslint/be/index.mjs', 'eslint-fe': 'packages/eslint/fe/index.mjs' });
const LINT_FAMILY = ['eslint-be', 'eslint-fe', 'stylelint'];
const CHECK_FAMILY = ['machine', 'hfs', 'work-validate'];
/** A Vietnamese text carries at least one letter no other language of this repository uses. */
const VIETNAMESE = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/** The rule ids of one eslint plugin package under `root`, or {error} when it cannot be loaded. */
export async function pluginRuleIds(root, kind) {
  const entry = PLUGIN_ENTRY[kind];
  try {
    const loaded = await import(pathToFileURL(path.join(root, entry)).href);
    const rules = loaded.default?.rules ?? loaded.rules;
    if (!rules || typeof rules !== 'object') return { error: `${entry} exports no rules` };
    return { ids: new Set(Object.keys(rules)) };
  } catch (error) {
    return { error: `${entry} cannot be loaded (${String(error?.message ?? error).split('\n')[0]})` };
  }
}

/**
 * The findings of a catalog: [{code, rule, enforcer?, message}].
 * plugins: {'eslint-be': {ids: Set} | {error}, 'eslint-fe': ...}; failureCodes: the parsed catalog; files: {exists(rel), read(rel)}.
 */
export function hfsRulesFindings({ catalog, plugins, failureCodes, files }) {
  const findings = [];
  const add = (code, rule, message, enforcer) => findings.push({ code, rule, ...(enforcer ? { enforcer } : {}), message });
  for (const rule of catalog.rules) {
    if (!rule.enforcers.length) add('HFS_RULE_NO_ENFORCER', rule.id, `${rule.id} (${rule.code}) has no enforcer`);
    for (const [kind, family, what] of [['lint', LINT_FAMILY, 'an eslint or stylelint rule'], ['check', CHECK_FAMILY, 'a machine, hfs or work-validate check']]) {
      if (rule.kinds.includes(kind) && !rule.enforcers.some((e) => family.includes(e.kind))) add('HFS_RULE_NO_ENFORCER', rule.id, `${rule.id} (${rule.code}) is kind ${kind} but names no ${what}`);
    }
    for (const enforcer of rule.enforcers) {
      const label = `${enforcer.kind}:${enforcer.id}`;
      if (enforcer.kind === 'eslint-be' || enforcer.kind === 'eslint-fe') {
        const plugin = plugins[enforcer.kind];
        if (plugin?.ids === undefined) {
          if (!enforcer.planned) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label} but ${plugin?.error ?? 'the plugin was not loaded'}`, label);
        } else if (enforcer.planned && plugin.ids.has(enforcer.id)) add('HFS_RULE_ENFORCER_STALE', rule.id, `${rule.id} lists ${label} as planned but the plugin already ships it; remove its status`, label);
        else if (!enforcer.planned && !plugin.ids.has(enforcer.id)) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label}, which is not a rule of ${PLUGIN_ENTRY[enforcer.kind]}`, label);
      } else if (!enforcer.planned && enforcer.at !== undefined) {
        if (!files.exists(enforcer.at)) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label} at ${enforcer.at}, which does not exist`, label);
        else if (!rule.failureCodes.some((c) => files.read(enforcer.at).includes(c))) add('HFS_RULE_ENFORCER_MISSING', rule.id, `${rule.id} names ${label} at ${enforcer.at}, but that file emits none of ${rule.failureCodes.join(', ')}`, label);
      }
    }
    for (const failureCode of rule.failureCodes) {
      const entry = failureCodes?.[failureCode];
      if (!entry) { add('HFS_RULE_CODE_UNCATALOGUED', rule.id, `${rule.id} reports ${failureCode}, which has no entry in ${FAILURE_CODES_FILE}`); continue; }
      for (const field of ['title_vi', 'meaning_vi', 'nextStep_vi']) {
        const value = entry[field];
        if (typeof value !== 'string' || !value.trim()) add('HFS_RULE_CODE_UNCATALOGUED', rule.id, `${failureCode} (${rule.id}) has no ${field}`);
        else if (!VIETNAMESE.test(value)) add('HFS_RULE_CODE_UNCATALOGUED', rule.id, `${failureCode} (${rule.id}) has a ${field} that is not Vietnamese`);
      }
    }
  }
  return findings;
}

/** Run the whole check against the runtime at `root`: {catalog, findings} or {refusal} when the catalog is refused. */
export async function checkHfsRules(root = skillRoot) {
  let catalog;
  try { catalog = loadRuleCatalog({ root, manifest: loadSlotManifest({ root }) }); } catch (error) {
    if (error instanceof HfsSlotsError) return { refusal: { code: error.code, message: error.message } };
    throw error;
  }
  const plugins = { 'eslint-be': await pluginRuleIds(root, 'eslint-be'), 'eslint-fe': await pluginRuleIds(root, 'eslint-fe') };
  const failureCodes = parseYaml(fs.readFileSync(path.join(root, FAILURE_CODES_FILE), 'utf8')) ?? {};
  const files = { exists: (rel) => fs.existsSync(path.join(root, rel)), read: (rel) => fs.readFileSync(path.join(root, rel), 'utf8') };
  return { catalog, findings: hfsRulesFindings({ catalog, plugins, failureCodes, files }) };
}

if (isMain(import.meta.url)) {
  const result = await checkHfsRules();
  const json = process.argv.includes('--json');
  if (result.refusal) {
    if (json) console.log(JSON.stringify({ ok: false, refusal: result.refusal }, null, 2)); else console.error(result.refusal.message);
    process.exit(1);
  }
  const { catalog, findings } = result;
  const planned = catalog.planned();
  const unbuilt = catalog.unbuilt().map((r) => ({ rule: r.id, code: r.code, planned: r.enforcers.map((e) => `${e.kind}:${e.id}`) }));
  const enforcers = catalog.rules.reduce((n, r) => n + r.enforcers.length, 0);
  const ok = findings.length === 0;
  if (json) console.log(JSON.stringify({ ok, rules: catalog.rules.length, enforcers, planned: planned.length, unbuilt, findings }, null, 2));
  else {
    for (const f of findings) console.error(`${f.code} ${f.rule}: ${f.message}`);
    if (process.argv.includes('--unbuilt')) for (const u of unbuilt) console.log(`${u.rule}\t${u.code}\t${u.planned.join(' ')}`);
    if (ok) console.log(`OK: ${catalog.rules.length} rules, ${enforcers - planned.length} of ${enforcers} enforcers built, ${planned.length} planned, ${unbuilt.length} rules with no built enforcer yet (${FAILURE_CODES_FILE} names every failure code).`);
  }
  process.exit(ok ? 0 : 1);
}
