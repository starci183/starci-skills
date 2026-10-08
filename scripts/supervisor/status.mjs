#!/usr/bin/env node
// starci supervisor status — the seat's health and the Supervisor's menu: the judgment points waiting on it
// (modules/supervisor/supervisor-menu.yaml), each answered with `starci supervisor decide`.
//   starci supervisor status [--json]         the seat status; --json adds menu[]
//   starci supervisor status --menu           the menu lines only
import { isMain } from '../lib/is-main.mjs';
import { supervisorStatus } from './start-supervisor.mjs';
import { readSupervisorMenu } from './supervisor-menu-sources.mjs';
import { supervisorMenuLines } from './supervisor-menu.mjs';

const seatLine = (status) => {
  const enabled = { true: 'enabled', false: 'DISABLED' }[String(status.enabled)] ?? 'never started';
  return `[Supervisor] mode ${status.supervisorMode}; ${enabled}; seat ${status.seat?.terminal ?? 'none'} (${status.health?.reason ?? '-'})`;
};

if (isMain(import.meta.url)) {
  const argv = new Set(process.argv.slice(2));
  const menu = readSupervisorMenu();
  if (argv.has('--menu')) console.log(supervisorMenuLines(menu).join('\n'));
  else {
    const status = { ...(await supervisorStatus()), menu };
    console.log(argv.has('--json') ? JSON.stringify(status) : [seatLine(status), ...supervisorMenuLines(menu)].join('\n'));
  }
}
