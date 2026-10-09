// replay-child-trap.mjs - a preload (node --import) every process of a replay world carries: it records each DETACHED child a process starts (child_process.spawn with
// detached: true) as one JSON line in the file STARCI_REPLAY_CHILDREN names. A replayed pass must end when its work ends: a detached child outlives it and races whatever the spec
// does next (the ack of a READ, its own push), so the world reads this log after every pass (world.leakedChildren) and fails the spec for a child still alive. The live engine
// keeps its detached push; a replay that asks for it says so (engine option detachedPush).
import fs from 'node:fs';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

const log = process.env.STARCI_REPLAY_CHILDREN;
const spawn = cp.spawn;
cp.spawn = function trapped(command, args, options) {
  const child = spawn.apply(this, arguments);
  const opts = Array.isArray(args) ? options : args;
  if (log && opts?.detached === true && child.pid) {
    const argv = (Array.isArray(args) ? args : []).map((a) => String(a).replace(/\\/g, '/').split('/').slice(-2).join('/')).join(' ').slice(0, 160);
    fs.appendFileSync(log, `${JSON.stringify({ pid: child.pid, by: process.pid, command: String(command).split(/[\\/]/).at(-1), argv })}\n`);
  }
  return child;
};
syncBuiltinESMExports();
