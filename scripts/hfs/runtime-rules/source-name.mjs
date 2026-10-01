// source-name.mjs - RT_SOURCE_NAME (knowledge/hfs/rules.yaml, gate runtime): a runtime source file is named
// <kebab-name>.mjs (ruleParams.runtime.sourceName), never as a one-off (ruleParams.runtime.oneOffNames: _*, tmp-*, fix-*,
// *-backfill, migrate-*, *-old, *.bak*...), and its basename is unique inside its tier except the shared basenames
// (ruleParams.runtime.sharedBasenames: an api system's lib.mjs, index.mjs). The tier is the file's slot tier; a forbidden
// or untiered file is judged by name only. Pure.
import path from 'node:path';
import { globExpression } from '../../lib/glob.mjs';

export const CODE = 'RT_SOURCE_NAME';
const STEM = /\.(?:[cm]?js|ts)$/;

/** The RT_SOURCE_NAME findings of one file's name (duplicates are judged across files). */
export function nameFindings(file, { sourceName, oneOffNames }) {
  const base = path.posix.basename(file);
  const stem = base.replace(STEM, '');
  const found = [];
  const oneOff = oneOffNames.find((pattern) => globExpression(pattern).test(base) || globExpression(pattern).test(stem));
  if (oneOff) found.push({ code: CODE, level: 'error', path: file, message: `${file} carries the one-off name ${oneOff}: a runtime source is a durable module; a one-off goes to the scratchpad, a migration to engine/db/migrations/<store>/` });
  else if (!new RegExp(sourceName).test(stem)) found.push({ code: CODE, level: 'error', path: file, message: `${file}: the name ${stem} is not kebab-case (${sourceName})` });
  return found;
}

/** RT_SOURCE_NAME over the runtime's production sources (ctx of scripts/hfs/runtime-check.mjs). */
export function sourceNameFindings(ctx) {
  const { sharedBasenames } = ctx.params;
  const found = [];
  const byTier = new Map();
  for (const { path: file } of ctx.sources) {
    found.push(...nameFindings(file, ctx.params));
    const tier = ctx.resolver.tierOf(file);
    const base = path.posix.basename(file);
    if (!tier || tier === 'none' || sharedBasenames.includes(base)) continue;
    const key = `${tier}\0${base}`;
    byTier.set(key, [...(byTier.get(key) ?? []), file]);
  }
  for (const [key, files] of byTier) {
    if (files.length < 2) continue;
    const [tier, base] = key.split('\0');
    for (const file of files) found.push({ code: CODE, level: 'error', path: file, message: `${file}: the basename ${base} repeats inside the ${tier} tier (${files.filter((f) => f !== file).join(', ')}); give each module a name of its own` });
  }
  return found;
}
