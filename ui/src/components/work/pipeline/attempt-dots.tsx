import type { Concept } from '../../concept';
export const concept: Concept = 'C7';
import type { AttemptBrief } from '../../../contract';
import { statusLabels, statusTone } from '../../status';

/** One dot per attempt, coloured by the attempt's own status (SVG). */
export function AttemptDotsSvg({ attempts, x, y, max = 12 }: { attempts: AttemptBrief[]; x: number; y: number; max?: number }) {
  const shown = attempts.slice(-max);
  return <g aria-hidden="true">{shown.map((attempt, i) => <circle key={attempt.id} cx={x + i * 12 + 4} cy={y} r={4.5} data-tone={statusTone[attempt.status]} fill="var(--tone)" >
    <title>{`Lần thử #${attempt.id} · ${statusLabels[attempt.status]}`}</title></circle>)}
    {attempts.length > max && <text x={x + shown.length * 12 + 2} y={y + 4} className="fill-muted-foreground" fontSize="11">+{attempts.length - max}</text>}</g>;
}
