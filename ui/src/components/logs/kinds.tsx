import { AlertTriangle, ArrowUpRight, Check, Cog, Diamond, FileText, Flag, GitMerge, ListChecks, Pencil, Scale, ShieldAlert, Terminal, Trash2, Dot, type LucideIcon } from 'lucide-react';
import type { LogRow } from '../../contract';
import type { Concept } from '../concept';
import { t } from '../../i18n/t';

export const concept: Concept = 'C17';

/** One icon per log-kind family (prefix before the first dot, or the whole kind). */
const familyIcons: Record<string, LucideIcon> = {
  file: Pencil, cmd: Terminal, step: Flag, decision: Diamond, dispatch: ArrowUpRight, verdict: Scale, settle: Scale,
  check: ListChecks, land: GitMerge, reconciler: Cog, incident: AlertTriangle, warning: AlertTriangle, report: FileText,
  gc: Trash2, invariant: ShieldAlert,
};
export function kindIcon(kind: string): LucideIcon {
  const family = kind.split('.')[0];
  if (kind === 'step.end') return Check;
  return familyIcons[family] ?? Dot;
}

export const levelLabels: Record<LogRow['level'], string> = { debug: 'DEBUG', info: 'INFO', warn: 'WARN', error: 'ERROR' };
/** debug/info stay neutral (no tone); warn = warning tone, error = failed tone. */
export const levelTone: Record<LogRow['level'], 'warning' | 'failed' | undefined> = { debug: undefined, info: undefined, warn: 'warning', error: 'failed' };

/** Kind-prefix choices for the filter (server matches by prefix). */
export const kindFamilies: { value: string; label: string }[] = [
  { value: '', label: t('All kinds') }, { value: 'step.', label: t('step.* — step') }, { value: 'file.', label: t('file.* — file edit') },
  { value: 'cmd.', label: t('cmd.* — command') }, { value: 'decision', label: t('decision — decision') }, { value: 'dispatch', label: t('dispatch — dispatch') },
  { value: 'settle', label: t('settle — settle') }, { value: 'check.', label: t('check.* — check') }, { value: 'land', label: t('land — land') },
  { value: 'reconciler.', label: t('reconciler.* — reconciler') }, { value: 'incident', label: t('incident — incident') },
];

const ansiPattern = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_])/g;
/** Strip ANSI escape sequences so terminal output reads as plain text. */
export const stripAnsi = (text: string) => text.replace(ansiPattern, '');
