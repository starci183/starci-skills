import os from 'node:os';
import { execFile } from 'node:child_process';
import { sendJson } from '../envelope.mjs';
import { translator } from '../../../scripts/lib/i18n.mjs';

const tr = translator('vi');

// Read-only host telemetry. Every external command is a fixed argv (never built from request input) and cached.
const run = (file, args, timeout) => new Promise(resolve => {
  try { execFile(file, args, { timeout, windowsHide: true, maxBuffer: 1 << 20 }, (error, stdout) => resolve(error ? null : String(stdout))); }
  catch { resolve(null); }
});
const ps = (script, timeout = 8000) => run('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], timeout);
const num = value => { const n = Number(String(value).trim()); return Number.isFinite(n) ? n : null; };

// Lazy TTL cache: returns the last value immediately, refreshes in the background when stale.
function cached(ttl, load, initial) {
  let value = initial, at = 0, inflight = null;
  return () => {
    if (!inflight && (at === 0 || Date.now() - at >= ttl)) {
      at = Date.now();
      inflight = Promise.resolve().then(load).then(next => { value = next; }, () => {}).finally(() => { inflight = null; });
    }
    return value;
  };
}

// Prime the once-only probes at startup.
const cpuInfo = cached(Infinity, async () => {
  const out = await ps('$p=Get-CimInstance Win32_Processor|Select-Object -First 1;"$($p.NumberOfCores),$($p.NumberOfLogicalProcessors)"');
  const [cores, threads] = (out ?? '').trim().split(',').map(num);
  return { cores, threads };
}, null);
const tempInfo = cached(Infinity, async () => {
  const out = await ps('try{$t=Get-CimInstance -Namespace root/wmi MSAcpi_ThermalZoneTemperature -ErrorAction Stop|Select-Object -First 1;[math]::Round($t.CurrentTemperature/10-273.15,1)}catch{}');
  const value = num(out ?? '');
  return out && value != null && value > 0 && value < 130 ? value : null;
}, null);
const gpuInfo = cached(10_000, async () => {
  const out = await run('nvidia-smi', ['--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw', '--format=csv,noheader,nounits'], 3000);
  if (!out) return [];
  return out.split(/\r?\n/).filter(Boolean).map(line => {
    const [name, temp, util, used, total, power] = line.split(',').map(part => part.trim());
    return { name, tempC: num(temp), utilPct: num(util), memUsedMb: num(used), memTotalMb: num(total), powerW: num(power) };
  });
}, []);
const diskInfo = cached(60_000, async () => {
  const out = await ps('Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"|ForEach-Object{"$($_.DeviceID),$($_.Size),$($_.FreeSpace)"}');
  if (!out) return [];
  return out.split(/\r?\n/).filter(Boolean).map(line => {
    const [mount, size, free] = line.trim().split(',');
    return { mount, totalGb: Math.round(Number(size) / 1e8) / 10, freeGb: Math.round(Number(free) / 1e8) / 10 };
  }).filter(disk => disk.mount && disk.totalGb > 0);
}, []);

// Load % from two cpus() samples: the delta since the previous request (min 1 s apart), else since process start.
const times = () => os.cpus().reduce((acc, cpu) => { const t = cpu.times; acc.idle += t.idle; acc.total += t.user + t.nice + t.sys + t.idle + t.irq; return acc; }, { idle: 0, total: 0 });
let prev = times(), prevAt = Date.now(), lastLoad = null;
function loadPct() {
  if (Date.now() - prevAt >= 1000) {
    const now = times(), total = now.total - prev.total, idle = now.idle - prev.idle;
    if (total > 0) lastLoad = Math.round(Math.max(0, Math.min(100, (1 - idle / total) * 100)) * 10) / 10;
    prev = now; prevAt = Date.now();
  }
  return lastLoad;
}
setInterval(loadPct, 5000).unref();

function machineView(store) {
  const db = store.machine?.db;
  if (!db) return { latest: null, footprint: null, history: [] };
  const latest = db.prepare("SELECT cpu_pct,free_ram_pct,mode,running FROM host_samples WHERE kind='host' ORDER BY seq DESC LIMIT 1").get() ?? null;
  const fp = db.prepare("SELECT detail_json FROM host_samples WHERE kind='op-footprint' ORDER BY seq DESC LIMIT 1").get();
  let footprint = null;
  try { footprint = JSON.parse(fp?.detail_json ?? 'null')?.agentRamMb ?? null; } catch { /* keep null */ }
  const history = db.prepare("SELECT at,cpu_pct,free_ram_pct FROM host_samples WHERE kind='host' ORDER BY seq DESC LIMIT 60").all().reverse()
    .map(row => ({ at: row.at, cpuPct: row.cpu_pct, freeRamPct: row.free_ram_pct }));
  return { latest, footprint, history };
}

export async function handleHost(request, response, store, url) {
  if (url.pathname !== '/api/host') return false;
  const cpus = os.cpus(), totalMb = Math.round(os.totalmem() / 1048576), freeMb = Math.round(os.freemem() / 1048576);
  const cores = cpuInfo();
  const { latest, footprint, history } = machineView(store);
  const gpuTemp = gpuInfo()[0]?.tempC ?? null;
  const view = {
    at: Date.now(), name: os.hostname() || null, os: `${os.type()} ${os.release()}`, uptimeSec: Math.round(os.uptime()),
    cpu: { model: (cpus[0]?.model ?? tr('unknown')).replace(/\s+/g, ' ').trim(), cores: cores?.cores ?? cpus.length, threads: cores?.threads ?? cpus.length,
      loadPct: latest?.cpu_pct ?? loadPct(), tempC: tempInfo() },
    ram: { totalMb, freeMb, usedPct: Math.round((1 - freeMb / totalMb) * 1000) / 10 },
    gpus: gpuInfo(), disks: diskInfo(),
    agentsRamMb: footprint ?? {}, running: latest?.running ?? null, throttleMode: latest?.mode ?? null,
    history: history.map((row, index) => index === history.length - 1 ? { ...row, gpuTempC: gpuTemp } : row),
  };
  sendJson(request, response, view, { sources: [{ db: 'machine', rel: 'host_samples' }], cache: 'no-store' });
  return true;
}
setTimeout(() => { cpuInfo(); tempInfo(); gpuInfo(); diskInfo(); }, 0).unref?.();
