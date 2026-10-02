import { sendError } from '../envelope.mjs';

const MAX_PER_IP = 3;
const MAX_TOTAL = 200;
const perIp = new Map();
let total = 0;

function topicsOf(store, url) {
  const requested = (url.searchParams.get('topics') ?? 'workers,decisions,system,logs').split(',').map(x => x.trim());
  const names = new Set(store.projects().map(row => row.name));
  if (!requested.length || requested.length > 30) return null;
  for (const topic of requested) {
    if (['workers', 'decisions', 'system', 'logs'].includes(topic)) continue;
    const match = /^(wf|attempt):([^:]+):([^:]+)$/.exec(topic);
    if (!match || !names.has(match[2]) || !match[3]) return null;
  }
  return [...new Set(requested)];
}

function readMarks(store) {
  const marks = new Map();
  const machine = store.machine.db;
  for (const row of machine.prepare('SELECT topic,mark FROM v_live_marks').all()) marks.set(`machine:${row.topic}`, row.mark);
  marks.set('machine:data_version', machine.prepare('PRAGMA data_version').get()?.data_version ?? 0);
  for (const ledger of store.projects()) {
    const opened = store.ledger(ledger.name);
    if (!opened) continue;
    for (const row of opened.db.prepare('SELECT topic,mark FROM v_live_marks').all()) marks.set(`${ledger.name}:${row.topic}`, row.mark);
    marks.set(`${ledger.name}:data_version`, opened.db.prepare('PRAGMA data_version').get()?.data_version ?? 0);
  }
  return marks;
}

function related(topic, key) {
  if (topic === 'system') return key.startsWith('machine:');
  if (topic === 'workers') return !key.startsWith('machine:') || key === 'machine:data_version';
  if (topic === 'decisions') return key.endsWith(':decisions') || key === 'machine:sup_decisions'
    || key === 'machine:deliveries' || key.endsWith(':data_version');
  if (topic === 'logs') return key.endsWith(':logs') || key === 'machine:machine_logs' || key.endsWith(':data_version');
  const match = /^(wf|attempt):([^:]+):/.exec(topic);
  return Boolean(match && key.startsWith(`${match[2]}:`));
}

function markFor(topic, marks) {
  let max = 0;
  for (const [key, mark] of marks) if (related(topic, key)) max = Math.max(max, Number(mark) || 0);
  return max;
}

/** C17 read-only live invalidations; each frame has only topic, key, seq and at. */
export function handleLive(request, response, store, url) {
  if (url.pathname !== '/api/live') return false;
  if (!store.machine) { sendError(request, response, 503, 'MACHINE_UNAVAILABLE', 'Machine database unavailable'); return true; }
  const topics = topicsOf(store, url);
  if (!topics) { sendError(request, response, 400, 'BAD_TOPICS', 'Invalid topics'); return true; }
  if (request.method === 'HEAD') {
    response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' });
    response.end(); return true;
  }
  const ip = String(request.headers['cf-connecting-ip'] ?? request.socket.remoteAddress ?? 'unknown');
  if ((perIp.get(ip) ?? 0) >= MAX_PER_IP || total >= MAX_TOTAL) {
    sendError(request, response, 429, 'LIVE_LIMIT', 'Too many live connections'); return true;
  }
  perIp.set(ip, (perIp.get(ip) ?? 0) + 1); total++;
  let previous;
  try { previous = readMarks(store); }
  catch { perIp.set(ip, perIp.get(ip) - 1); total--; sendError(request, response, 503, 'MARKS_UNAVAILABLE', 'Live marks unavailable'); return true; }
  response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  let seq = 0, closed = false;
  const emit = topic => {
    const frame = { topic, key: topic, seq: markFor(topic, previous), at: Date.now() };
    response.write(`id: ${++seq}\nevent: invalidate\ndata: ${JSON.stringify(frame)}\n\n`);
  };
  // Last-Event-ID cannot describe every independent DB. A fresh subscription invalidates all requested topics.
  for (const topic of topics) emit(topic);
  const poll = () => {
    try {
      const current = readMarks(store);
      const changed = new Set([...current.keys(), ...previous.keys()].filter(key => current.get(key) !== previous.get(key)));
      previous = current;
      for (const topic of topics) if ([...changed].some(key => related(topic, key))) emit(topic);
    } catch { for (const topic of topics) emit(topic); }
  };
  const interval = setInterval(poll, 2000);
  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 15000);
  response.once('close', () => {
    if (closed) return;
    closed = true;
    clearInterval(interval); clearInterval(heartbeat);
    const remaining = (perIp.get(ip) ?? 1) - 1;
    if (remaining > 0) perIp.set(ip, remaining); else perIp.delete(ip);
    total--;
  });
  return true;
}
