// Common result shaping for the slot check and its optional proof reports.
import { loadRuleCatalog } from './slots.mjs';

/** Attach the localized catalog explanation to every finding. */
export function withWhy(findings, why) {
  return findings.map((f) => ({ ...f, title: why[f.code].title, titleVi: why[f.code].titleVi, whyVi: why[f.code].whyVi, nextStepVi: why[f.code].nextStepVi }));
}

/** Count findings by severity and code without dropping report-only results. */
export function summarize(findings) {
  const byCode = {};
  for (const f of findings) {
    byCode[f.code] ??= { level: f.level, count: 0 };
    byCode[f.code].count += 1;
  }
  return {
    error: findings.filter((f) => f.level === 'error').length,
    warning: findings.filter((f) => f.level === 'warning').length,
    info: findings.filter((f) => f.level === 'info').length,
    byCode,
  };
}

/** Keep findings judged in this edition; uncatalogued refusal codes always remain. */
export function judgedFindings(findings, edition, root) {
  const catalog = loadRuleCatalog({ root });
  return findings.filter((finding) => catalog.judgedIn(finding.code, edition));
}
