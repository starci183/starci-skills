// check-format.mjs — the one-line-per-check report every canon check CLI shares.

const MARK = { pass: 'pass', fail: 'FAIL', skip: 'skip' };

/** `header` plus one '  [outcome] id: detail' line per check of `checks`, joined with '\n'. */
export const formatCheckLines = (header, checks) =>
  [header, ...(checks ?? []).map((entry) => `  [${MARK[entry.outcome]}] ${entry.id}: ${entry.detail}`)].join('\n');
