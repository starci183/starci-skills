// pid-alive.mjs - whether a process id names a live process: the one probe the host locks, the file claim and the machine store share.

/** True while `pid` names a live process (EPERM counts as alive). */
export const pidAlive = (pid) => { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (error) { return error?.code === 'EPERM'; } };
