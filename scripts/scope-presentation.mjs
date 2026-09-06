import { readFileSync } from 'node:fs';
import path from 'node:path';
import { missionAt } from './mission-history.mjs';

const policy = JSON.parse(readFileSync(new URL('../resources/interaction.json', import.meta.url), 'utf8'));
const printable = value => value == null || value === '' ? 'Not established' : typeof value === 'string' ? value : JSON.stringify(value);
const escape = value => printable(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '&#124;').replace(/[\r\n]+/g, ' ');
const list = values => values?.length ? values.map(printable).join('; ') : 'Not established';

function scopeRows(mission) {
  const discovery = mission.discovery ?? {};
  const impacts = discovery.impacts ?? [];
  return {
    'Biz/Goal': mission.goal,
    'Impact: routes': list(impacts.map(item => `${item.role}: ${list(item.routes)}`)),
    'Impact: code': list(impacts.map(item => {
      const repository = discovery.repositories?.find(repo => repo.role === item.role);
      return `${item.role} (${printable(repository?.repository)}): ${list(item.code)}${item.producer ? `; executed by ${item.producer.sessionId}, impact ${item.producer.impactId}, scope ${item.producer.mission.hash}` : ''}`;
    })),
    'Workflow forecast': list(Object.entries(discovery.lanes ?? {}).map(([id, lane]) => `${id}: ${lane.status}; owner ${printable(lane.owner)}; depends on ${list(lane.dependsOn)}; ${printable(lane.reason)}`)),
    'Done when': list(mission.doneWhen),
    'Target': mission.target,
    'In scope': list(mission.includes),
    'Out of scope': list(mission.excludes),
    'Outputs': list(mission.outputs),
    'Verification reach': mission.verification,
    'Example': mission.example,
  };
}

export function renderScope(mission, previous) {
  const current = scopeRows(mission);
  const before = previous ? scopeRows(previous) : null;
  const labels = policy.scopeTable.filter(label => !before || label === 'Workflow forecast' || printable(current[label]) !== printable(before[label]));
  return [
    `Confirm Goal — v${mission.version ?? '?'}${before ? ' (changes)' : ''}`,
    '', '| Item | Scope |', '| --- | --- |',
    ...labels.map(label => `| ${escape(label)} | ${escape(current[label])} |`),
    '', 'Workflow forecast: planned, not executed or verified. Missing values remain unresolved; this preview grants no authority.',
  ].join('\n');
}

export function previewScope(session) {
  const state = JSON.parse(readFileSync(path.join(session, 'state.json'), 'utf8'));
  if (!state.mission) throw Error('MISSION_MISSING: no scope to display');
  const versions = Object.keys(state.missionSnapshots ?? {}).map(Number).filter(version => version < state.mission.version).sort((a, b) => b - a);
  const previous = versions.length ? missionAt(session, state, versions[0]).mission : undefined;
  return renderScope(state.mission, previous);
}
