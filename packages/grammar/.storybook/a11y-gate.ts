/// <reference types="vite/client" />
import { afterEach } from 'vitest';
import allowlistFile from './a11y-allowlist.json';

/*
 * Setup file for the `test:a11y` projects (vitest.a11y.config.ts). addon-a11y runs axe after every
 * story in `todo` mode and attaches the result to the test's `meta.reports`; this hook turns that
 * report into a hard failure for every violation not waived in `a11y-allowlist.json`.
 */

type AllowlistEntry = { readonly storyId: string; readonly rule: string; readonly reason: string; readonly owner: string };

type AxeViolation = {
  readonly id: string;
  readonly impact?: string | null;
  readonly help: string;
  readonly helpUrl?: string;
  readonly nodes: ReadonlyArray<{ readonly target: ReadonlyArray<unknown> }>;
};

type A11yReport = {
  readonly type: string;
  readonly status: string;
  readonly result?: { readonly violations?: ReadonlyArray<AxeViolation>; readonly error?: unknown };
};

const FIELDS = ['storyId', 'rule', 'reason', 'owner'] as const;

const parseAllowlist = (file: unknown): ReadonlyArray<AllowlistEntry> => {
  const entries = (file as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) throw new Error('a11y-allowlist.json: `entries` must be an array');
  return entries.map((entry: unknown, index) => {
    const record = (entry ?? {}) as Record<string, unknown>;
    for (const field of FIELDS) {
      const value = record[field];
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`a11y-allowlist.json entries[${index}]: \`${field}\` must be a non-empty string`);
      }
    }
    const extra = Object.keys(record).filter((key) => !(FIELDS as ReadonlyArray<string>).includes(key));
    if (extra.length > 0) throw new Error(`a11y-allowlist.json entries[${index}]: unknown field(s) ${extra.join(', ')}`);
    return record as AllowlistEntry;
  });
};

const ALLOWLIST = parseAllowlist(allowlistFile);
const MATRIX = `${import.meta.env.VITE_GRAMMAR_FAMILY ?? 'core'} / ${import.meta.env.VITE_GRAMMAR_THEME ?? 'light'}`;

const isWaived = (storyId: string, rule: string) =>
  ALLOWLIST.some((entry) => entry.storyId === storyId && entry.rule === rule);

const describeViolation = (violation: AxeViolation) => {
  const targets = violation.nodes.slice(0, 5).map((node) => node.target.map(String).join(' ')).join(' | ');
  const more = violation.nodes.length > 5 ? ` (+${violation.nodes.length - 5} more)` : '';
  return `  - ${violation.id} [${violation.impact ?? 'n/a'}] ${violation.help}: ${targets}${more}`;
};

afterEach(({ task }) => {
  const meta = task.meta as { storyId?: string; reports?: ReadonlyArray<A11yReport> };
  if (typeof meta.storyId !== 'string') return;
  const storyId = meta.storyId;
  const reports = (meta.reports ?? []).filter((report) => report.type === 'a11y');
  if (reports.length === 0) {
    throw new Error(`a11y gate (${MATRIX}): no axe report for ${storyId}. Stories may not opt out of the gate; waive specific rules in .storybook/a11y-allowlist.json instead.`);
  }
  for (const report of reports) {
    if (report.result?.error !== undefined) {
      throw new Error(`a11y gate (${MATRIX}): axe failed to run on ${storyId}: ${String(report.result.error)}`);
    }
    const violations = (report.result?.violations ?? []).filter((violation) => !isWaived(storyId, violation.id));
    if (violations.length > 0) {
      throw new Error(
        `a11y gate (${MATRIX}): ${violations.length} unwaived violation(s) in ${storyId}\n${violations.map(describeViolation).join('\n')}\n` +
          'Fix them, or add a reviewed entry { storyId, rule, reason, owner } to .storybook/a11y-allowlist.json.',
      );
    }
  }
});
