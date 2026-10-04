import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleHost, createHostReader } from '../../ui/api/routes/host.mjs';

const serveHost = async (t) => {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (!(await handleHost(request, response, {}, url))) { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
};
const read = async (url) => { const r = await fetch(url); return { status: r.status, body: r.status === 200 ? await r.json() : null }; };

test('GET /api/host answers the host view; the PowerShell and nvidia-smi reads fill it in the background', async (t) => {
  const origin = await serveHost(t);
  assert.equal((await read(`${origin}/api/other`)).status, 404, 'another path is not the host route');
  const response = await read(`${origin}/api/host`);
  let view = response.body.data;
  assert.equal(view.cpu.cores, null, 'physical cores await the CPU topology observation');
  assert.ok(view.cpu.threads > 0, 'the OS exposes the logical processor count immediately');
  assert.equal(view.sources.cpuTopology.availability, 'pending');
  assert.equal(view.sources.cpuTopology.observedAt, null);
  assert.equal(view.sources.ram.observedAt, view.at, 'RAM is measured when this host view is read');
  assert.equal(view.sources.hostSample.availability, 'unavailable', 'missing machine samples are not healthy or zero');
  assert.equal(response.body.meta.sources.find(source => source.rel === 'cim:cpu-topology').at, null);
  assert.ok(Array.isArray(view.gpus) && Array.isArray(view.disks));
  if (process.platform !== 'win32') return;
  // The disk read goes through scripts/api/process/run-powershell-async.mjs; every fixed disk shows up once it lands.
  const until = Date.now() + 30_000;
  while (!view.disks.length && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    view = (await read(`${origin}/api/host`)).body.data;
  }
  assert.ok(view.disks.length > 0, 'the PowerShell disk read answered');
  for (const disk of view.disks) assert.ok(disk.mount && disk.totalGb > 0);
  assert.equal(view.sources.disks.availability, 'available');
  assert.ok(view.sources.disks.observedAt > 0, 'the completed disk probe has its own observation time');
});

const settle = () => new Promise(resolve => setImmediate(resolve));
function hostFixture() {
  let now = 10_000, probeFailed = false, machineFailed = false;
  const osReader = { cpus: () => [{ model: 'fixture CPU', times: { idle: 90, user: 10, nice: 0, sys: 0, irq: 0 } },
    { model: 'fixture CPU', times: { idle: 90, user: 10, nice: 0, sys: 0, irq: 0 } }],
    totalmem: () => 8 * 1048576, freemem: () => 4 * 1048576, hostname: () => 'fixture', type: () => 'TestOS', release: () => '1', uptime: () => 60 };
  const machine = { db: { prepare: sql => ({
    get() {
      if (machineFailed) throw new Error('fixture database unavailable');
      return sql.includes('op-footprint') ? { at: 1300, detail_json: '{"agentRamMb":{"codex":320}}' }
        : { at: 1200, cpu_pct: 17, free_ram_pct: 50, mode: 'normal', running: 2 };
    },
    all() { if (machineFailed) throw new Error('fixture database unavailable'); return [{ at: 1200, cpu_pct: 17, free_ram_pct: 50 }]; },
  }) } };
  const reader = createHostReader({ clock: () => now, osReader, probeReaders: {
    topology: async () => ({ cores: 1, threads: 2 }),
    temperature: async () => { if (probeFailed) throw new Error('fixture sensor unavailable'); return 42; },
    gpu: async () => [], disks: async () => [{ mount: 'X:', totalGb: 10, freeGb: 4 }],
  } });
  return { read: () => reader({ machine }), advance: value => { now = value; }, failProbe: () => { probeFailed = true; }, failMachine: () => { machineFailed = true; } };
}

test('host source clocks preserve recorded machine observations independently of response and sensor clocks', async () => {
  const fixture = hostFixture();
  const initial = fixture.read();
  assert.equal(initial.cpu.cores, null);
  assert.equal(initial.cpu.threads, 2);
  assert.equal(initial.hostSampleAt, 1200);
  assert.equal(initial.sources.cpuLoad.observedAt, 1200);
  assert.equal(initial.agentsRamObservedAt, 1300);
  assert.equal(initial.sources.gpu.availability, 'pending', 'an unfinished empty cache is unknown');
  await settle();
  fixture.advance(10_500);
  const view = fixture.read();
  assert.equal(view.cpu.cores, 1, 'physical cores come from the completed topology reader');
  assert.equal(view.sources.cpuTopology.observedAt, 10_000);
  assert.equal(view.sources.ram.observedAt, 10_500);
  assert.equal(view.cpu.loadPct, 17);
  assert.equal(view.sources.cpuLoad.observedAt, 1200);
  assert.equal(view.sources.gpu.availability, 'available', 'a successful empty GPU read differs from an unfinished probe');
  assert.deepEqual(view.gpus, []);
  assert.deepEqual(view.history, [{ at: 1200, cpuPct: 17, freeRamPct: 50 }], 'no current sensor value is attached to an older machine sample');
});

test('failed refresh retains last good sensor and machine values with their observation time and failure', async () => {
  const fixture = hostFixture();
  fixture.read(); await settle();
  fixture.advance(21_000); fixture.failProbe(); fixture.failMachine();
  assert.equal(fixture.read().sources.cpuTemperature.refreshing, true);
  await settle();
  const view = fixture.read();
  assert.equal(view.cpu.tempC, 42);
  assert.equal(view.sources.cpuTemperature.observedAt, 10_000);
  assert.equal(view.sources.cpuTemperature.readAt, 21_000);
  assert.equal(view.sources.cpuTemperature.availability, 'unavailable');
  assert.equal(view.sources.cpuTemperature.cached, true);
  assert.equal(view.sources.cpuTemperature.error, 'fixture sensor unavailable');
  assert.equal(view.hostSampleAt, 1200);
  assert.equal(view.sources.hostSample.availability, 'unavailable');
  assert.equal(view.sources.hostSample.cached, true);
  assert.equal(view.sources.cpuLoad.observedAt, 1200);
  assert.equal(view.agentsRamMb.codex, 320);
  assert.equal(view.sources.agentFootprint.observedAt, 1300);
  assert.equal(view.sources.agentFootprint.availability, 'unavailable');
});
