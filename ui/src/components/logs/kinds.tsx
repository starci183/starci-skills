import { AlertTriangle, ArrowUpRight, Check, Cog, Diamond, FileText, Flag, GitMerge, ListChecks, Pencil, Scale, ShieldAlert, Terminal, Trash2, Dot, type LucideIcon } from 'lucide-react';
import type { LogRow } from '../../contract';
import type { Concept } from '../concept';

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
  { value: '', label: 'Mọi loại' }, { value: 'step.', label: 'step.* — bước' }, { value: 'file.', label: 'file.* — sửa tệp' },
  { value: 'cmd.', label: 'cmd.* — lệnh' }, { value: 'decision', label: 'decision — quyết định' }, { value: 'dispatch', label: 'dispatch — giao việc' },
  { value: 'settle', label: 'settle — chốt' }, { value: 'check.', label: 'check.* — kiểm tra' }, { value: 'land', label: 'land — hạ cánh' },
  { value: 'reconciler.', label: 'reconciler.* — bộ điều phối' }, { value: 'incident', label: 'incident — sự cố' },
];

const ansiPattern = new RegExp(String.raw`\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_])`, 'g');
/** Strip ANSI escape sequences so terminal output reads as plain text. */
export const stripAnsi = (text: string) => text.replace(ansiPattern, '');
