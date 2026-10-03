import os from 'node:os';
import { runPowershellAsync } from '../../../scripts/api/process/run-powershell-async.mjs';
import { gpuQuery } from '../../../scripts/api/process/gpu-query.mjs';
import { sendJson } from '../envelope.mjs';
const num = value => {
  if (value == null || String(value).trim() === '') return null;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
};
const positiveInt = value => Number.isInteger(value) && value > 0 ? value : null;
const probes = {
  topology: async () => {
    const out = await runPowershellAsync('$p=Get-CimInstance Win32_Processor|Select-Object -First 1;"$($p.NumberOfCores),$($p.NumberOfLogicalProcessors)"');
    const [cores, threads] = (out ?? '').trim().split(',').map(num);
    if (positiveInt(cores) == null && positiveInt(threads) == null) throw new Error('CPU topology probe returned no reading');
    return { cores: positiveInt(cores), threads: positiveInt(threads) };
  },
  temperature: async () => {
    const out = await runPowershellAsync('try{$t=Get-CimInstance -Namespace root/wmi MSAcpi_ThermalZoneTemperature -ErrorAction Stop|Select-Object -First 1;[math]::Round($t.CurrentTemperature/10-273.15,1)}catch{}');
    const value = num(out);
    if (value == null) throw new Error('CPU temperature probe returned no reading');
    return value;
  },
  gpu: async () => {
    const out = await gpuQuery(['name', 'temperature.gpu', 'utilization.gpu', 'memory.used', 'memory.total', 'power.draw'], 3000);
    if (out == null) throw new Error('GPU probe unavailable');
    return out.split(/\r?\n/).filter(Boolean).map(line => {
      const [name, temp, util, used, total, power] = line.split(',').map(part => part.trim());
      return { name, tempC: num(temp), utilPct: num(util), memUsedMb: num(used), memTotalMb: num(total), powerW: num(power) };
    });
  },
  disks: async () => {
    const out = await runPowershellAsync('Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"|ForEach-Object{"$($_.DeviceID),$($_.Size),$($_.FreeSpace)"}');
    if (out == null) throw new Error('Disk probe unavailable');
    return out.split(/\r?\n/).filter(Boolean).map(line => {
      const [mount, size, free] = line.trim().split(','), total = num(size), available = num(free);
      return { mount, totalGb: total == null ? null : Math.round(total / 1e8) / 10, freeGb: available == null ? null : Math.round(available / 1e8) / 10 };
    }).filter(disk => disk.mount && disk.totalGb != null && disk.totalGb > 0 && disk.freeGb != null);
  },
};

const observation = (source, observedAt, readAt, extra = {}) => ({ source, observedAt, readAt,
  cached: false, refreshing: false, availability: 'available', error: null, ...extra });

/** Injected probes make cache/failure projections verifiable without probing this host. */
export function createHostReader({ clock = Date.now, osReader = os, probeReaders = probes } = {}) {
  function cache(source, ttl, load, initial) {
    let value = initial, observedAt = null, readAt = null, inflight = null, error = null;
    return () => {
      if (!inflight && (readAt == null || clock() - readAt >= ttl)) {
        inflight = Promise.resolve().then(load).then(next => {
          value = next; observedAt = clock(); error = null;
        }, failed => { error = String(failed?.message ?? failed); }).finally(() => { readAt = clock(); inflight = null; });
      }
      return { value, source: observation(source, observedAt, readAt, { cached: observedAt != null,
        refreshing: Boolean(inflight), availability: error ? 'unavailable' : observedAt == null ? 'pending' : 'available', error }) };
    };
  }
  const topology = cache('cim:cpu-topology', 60_000, probeReaders.topology, null);
  const temperature = cache('cim:cpu-temperature', 10_000, probeReaders.temperature, null);
  const gpu = cache('nvidia-smi', 10_000, probeReaders.gpu, []);
  const disks = cache('cim:disks', 60_000, probeReaders.disks, []);
  const times = cpus => cpus.reduce((acc, cpu) => {
    const value = cpu.times; acc.idle += value.idle; acc.total += value.user + value.nice + value.sys + value.idle + value.irq; return acc;
  }, { idle: 0, total: 0 });
  let previous = null, previousAt = null, load = null, loadAt = null;
  let hostSnapshot = { latest: null, history: [] }, footprint = { at: null, agents: {} };
  function machineReads(store, at) {
    let hostSource, footprintSource;
    try {
      const db = store.machine?.db;
      if (!db) throw new Error('Machine host samples unavailable');
      const latest = db.prepare("SELECT at,cpu_pct,free_ram_pct,mode,running FROM host_samples WHERE kind='host' ORDER BY seq DESC LIMIT 1").get() ?? null;
      const history = db.prepare("SELECT at,cpu_pct,free_ram_pct FROM host_samples WHERE kind='host' ORDER BY seq DESC LIMIT 60").all().reverse()
        .map(row => ({ at: row.at, cpuPct: row.cpu_pct, freeRamPct: row.free_ram_pct }));
      hostSnapshot = { latest, history };
      hostSource = observation('machine:host_samples', latest?.at ?? null, at);
    } catch (error) {
      hostSource = observation('machine:host_samples', hostSnapshot.latest?.at ?? null, at,
        { availability: 'unavailable', cached: hostSnapshot.latest != null, error: String(error.message) });
    }
    try {
      const db = store.machine?.db;
      if (!db) throw new Error('Machine agent footprint unavailable');
      const row = db.prepare("SELECT at,detail_json FROM host_samples WHERE kind='op-footprint' ORDER BY seq DESC LIMIT 1").get();
      const agents = row ? JSON.parse(row.detail_json ?? 'null')?.agentRamMb : null;
      if (row && (!agents || typeof agents !== 'object' || Array.isArray(agents))) throw new Error('Agent footprint has no recorded measurements');
      footprint = { at: row?.at ?? null, agents: agents ?? {} };
      footprintSource = observation('machine:op-footprint', footprint.at, at);
    } catch (error) {
      footprintSource = observation('machine:op-footprint', footprint.at, at,
        { availability: 'unavailable', cached: footprint.at != null, error: String(error.message) });
    }
    return { hostSource, footprintSource };
  }
  return store => {
    const at = clock(), cpus = osReader.cpus(), currentTimes = times(cpus);
    if (previous != null && at - previousAt >= 1000) {
      const total = currentTimes.total - previous.total, idle = currentTimes.idle - previous.idle;
      if (total > 0) { load = Math.round(Math.max(0, Math.min(100, (1 - idle / total) * 100)) * 10) / 10; loadAt = at; }
      previous = currentTimes; previousAt = at;
    } else if (previous == null) { previous = currentTimes; previousAt = at; }
    const cpu = topology(), temp = temperature(), gpus = gpu(), storage = disks();
    const { hostSource, footprintSource } = machineReads(store, at), { latest, history } = hostSnapshot;
    const totalMb = Math.round(osReader.totalmem() / 1048576), freeMb = Math.round(osReader.freemem() / 1048576);
    const recordedLoad = latest?.cpu_pct != null;
    return { at, name: osReader.hostname() || null, os: `${osReader.type()} ${osReader.release()}`, uptimeSec: Math.round(osReader.uptime()),
      cpu: { model: (cpus[0]?.model ?? 'unknown').replace(/\s+/g, ' ').trim(), cores: cpu.value?.cores ?? null,
        threads: cpu.value?.threads ?? positiveInt(cpus.length), loadPct: recordedLoad ? latest.cpu_pct : load, tempC: temp.value },
      ram: { totalMb, freeMb, usedPct: Math.round((1 - freeMb / totalMb) * 1000) / 10 },
      gpus: gpus.value, disks: storage.value, agentsRamMb: footprint.agents, agentsRamObservedAt: footprint.at,
      hostSampleAt: latest?.at ?? null, running: latest?.running ?? null, throttleMode: latest?.mode ?? null, history,
      sources: { os: observation('node:os', at, at), ram: observation('node:os-memory', at, at), cpuTopology: cpu.source,
        cpuLoad: recordedLoad ? hostSource : observation('node:os-cpu-delta', loadAt, at), cpuTemperature: temp.source,
        gpu: gpus.source, disks: storage.source, hostSample: hostSource, agentFootprint: footprintSource },
    };
  };
}

const readHost = createHostReader();
export async function handleHost(request, response, store, url) {
  if (url.pathname !== '/api/host') return false;
  const view = readHost(store);
  sendJson(request, response, view, { sources: Object.values(view.sources).map(source => ({
    db: source.source.startsWith('machine:') ? 'machine' : 'host', rel: source.source,
    at: source.observedAt, readAt: source.readAt, availability: source.availability, error: source.error,
  })), stale: Object.values(view.sources).filter(source => source.availability === 'unavailable').map(source => source.source), cache: 'no-store' });
  return true;
}
