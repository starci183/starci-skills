// A loopback seat fixture runs in its own thread while synchronous CLI children are being observed.
import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

const serverSource = `
const { workerData } = require('node:worker_threads');
const http = require('node:http');
const ready = new Int32Array(workerData.ready);
const server = http.createServer((request, response) => {
  request.resume();
  request.on('end', () => {
    const now = Date.now();
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ userStatus: { planStatus: {
      dailyQuotaRemainingPercent: 88, weeklyQuotaRemainingPercent: 88,
      dailyQuotaResetAtUnix: (now + 86400000) / 1000,
      weeklyQuotaResetAtUnix: (now + 604800000) / 1000,
    } } }));
  });
});
server.listen(0, '127.0.0.1', () => { Atomics.store(ready, 1, server.address().port); Atomics.store(ready, 0, 1); Atomics.notify(ready, 0); });
`;

/** Fresh successful auth and quota evidence, always against localhost and dummy credentials. */
export function fakeDevinQuotaEnv(t, directory) {
  const ready = new SharedArrayBuffer(8), state = new Int32Array(ready);
  const worker = new Worker(serverSource, { eval: true, workerData: { ready } });
  t.after(() => worker.terminate());
  const waited = Atomics.wait(state, 0, 0, 10000), port = Atomics.load(state, 1);
  if (waited === 'timed-out' || !port) throw new Error('loopback seat fixture did not start');
  fs.mkdirSync(path.join(directory, 'devin'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'devin', 'credentials.toml'), 'windsurf_api_key = "fixture"\n');
  return { APPDATA: directory, STARCI_DEVIN_SEAT_ENDPOINT: `http://127.0.0.1:${port}/quota` };
}
