// replay-host-trap.mjs - a preload (node --import) every process of a replay world carries: it records each read of the real host's load, memory or disk
// (os.freemem, os.totalmem, os.cpus, os.loadavg, fs.statfsSync) as one JSON line in the file STARCI_REPLAY_HOST_READS names, with the calling frame. A replayed pass
// takes its host readings from the injected sample (STARCI_HOST_RESOURCES_JSON), so the log stays empty; a read in it is a verdict the machine, not the code, decided.
import fs from 'node:fs';
import os from 'node:os';
import { syncBuiltinESMExports } from 'node:module';

const log = process.env.STARCI_REPLAY_HOST_READS;
const record = (name) => {
  if (!log) return;
  const frame = String(new Error().stack).split('\n').slice(3, 5).map((line) => line.trim().replace(/^at /, '').replace(/\(?file:\/\/\/?/, '(')).join(' < ');
  fs.appendFileSync(log, `${JSON.stringify({ read: name, pid: process.pid, frame })}\n`);
};
for (const name of ['freemem', 'totalmem', 'cpus', 'loadavg']) {
  const original = os[name];
  os[name] = function trapped(...args) { record(`os.${name}`); return original.apply(this, args); };
}
const statfs = fs.statfsSync;
fs.statfsSync = function trapped(...args) { record('fs.statfsSync'); return statfs.apply(this, args); };
syncBuiltinESMExports();
