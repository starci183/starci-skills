import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../engine/config.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const providers = ['qwen', 'devin', 'claude', 'codex'];
const parse = (value) => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
const providerOf = (value) => {
  const name = String(value || '').toLowerCase();
  if (name.startsWith('qwen')) return 'qwen';
  return providers.find((provider) => name.startsWith(provider)) || null;
};
const terminalOf = (job, payload) => payload?.hierarchy?.runtime?.terminalHandle
  || payload?.managed?.agentTerminalHandle || payload?.orca?.agentTerminalHandle
  || (String(job.worker_id || '').startsWith('term_') ? job.worker_id : null);
const projectOf = (projects, worktreePath) => projects.find((project) =>
  worktreePath?.replaceAll('\\', '/').toLowerCase() === project.repo.toLowerCase());
const ownerLanguage = () => { try { return loadConfig()?.language || 'vi'; } catch { return 'vi'; } };

export function summarizeTask(op, title, workflowName, language = 'vi') {
  const original = String(title || '').trim();
  if (!language.startsWith('vi')) return original || op || workflowName || '';
  const source = `${original} ${workflowName || ''}`.toLowerCase();
  const target = /auth|login|đăng nhập/.test(source) ? 'luồng đăng nhập'
    : /purchase|provision|workspace/.test(source) ? 'luồng mua và cấp workspace'
    : /subscription|entitlement/.test(source) ? 'quyền truy cập gói học'
    : /module studio/.test(source) ? 'Module Studio'
    : /academy/.test(source) ? 'Academy'
    : workflowName ? `luồng ${workflowName}` : 'phạm vi được giao';
  if (/\brecapture\b|\bre-drive\b|\brefresh screens\b/.test(source)) return `Chụp lại bằng chứng giao diện ${target} trên bản chạy mới nhất`;
  if (/\brebind\b/.test(source)) return `Nối lại các thành phần của ${target} và kiểm tra luồng chạy`;
  if (op === 'interface.implement' && /\bpreview\b.*\buat\b|\b16 fresh\b/.test(source)) return `Chạy bản xem trước và kiểm tra lại các trạng thái của ${target}`;
  if (op === 'interface.implement') return `Hoàn thiện giao diện ${target} và kiểm tra kết quả hiển thị`;
  if (op === 'backend.implement') return `Hoàn thiện backend cho ${target} và kiểm tra tích hợp`;
  if (op === 'interface.audit') return `Soát giao diện ${target} theo thiết kế và bằng chứng hiện tại`;
  if (op === 'review.verify') return `Đối chiếu hồ sơ và bản triển khai của ${target} trước khi chốt kết quả`;
  if (/\bfix\b|\brepair\b/.test(source)) return `Sửa ${target} và chạy lại bước kiểm tra`;
  if (/\bverify\b|\btest\b/.test(source)) return `Kiểm tra ${target} trên bản triển khai hiện tại`;
  return `Thực hiện bước ${op || 'được giao'} cho ${target}`;
}

function ledgerAgents(projects, safe) {
  const agents = [];
  const errors = {};
  const language = ownerLanguage();
  for (const project of projects) {
    let db;
    try {
      db = new DatabaseSync(path.join(project.repo, '.starciwork', 'runtime.sqlite'), { readOnly: true });
      const rows = db.prepare(`SELECT j.job_id, j.workflow_id, j.kind, j.op_id, j.attempt, j.status, j.worker_id,
        j.payload_json, j.created_at, w.title AS workflow_title
        FROM jobs j JOIN workflows w ON w.workflow_id=j.workflow_id
        WHERE j.status IN ('running','answering','leased') AND w.phase='running' AND w.archived_at IS NULL
        ORDER BY j.updated_at DESC`).all();
      for (const job of rows) {
        const payload = parse(job.payload_json);
        const runtime = payload?.hierarchy?.runtime || {};
        const provider = providerOf(runtime.agent || runtime.provider || payload.provider || payload.agent || payload.route?.agent);
        const handle = terminalOf(job, payload);
        agents.push({
          id: safe(job.job_id), workflowId: safe(job.workflow_id), workflowName: safe(job.workflow_title),
          projectId: project.id, projectName: project.name, role: job.kind === 'kernel' ? 'kernel' : 'op',
          op: safe(job.op_id || ''), attempt: job.attempt ?? null,
          task: safe(job.kind === 'kernel' ? `Điều phối ${job.workflow_title || job.workflow_id}` : payload.title || job.op_id || '', 1200),
          action: safe(job.kind === 'kernel' ? `Điều phối luồng ${job.workflow_title || job.workflow_id}`
            : summarizeTask(job.op_id, payload.title, job.workflow_title, language), 300),
          cut: payload.cut && Number.isInteger(payload.cut.ordinal) && Number.isInteger(payload.cut.total)
            ? { ordinal: payload.cut.ordinal, total: payload.cut.total } : null,
          status: safe(job.status), provider,
          model: safe(runtime.model || payload.modelId || payload.model || '') || null,
          terminal: handle && /^term_[a-z0-9-]+$/i.test(handle) ? handle : null,
          since: job.created_at,
        });
      }
    } catch (error) { errors[project.id] = safe(error.message); }
    finally { db?.close(); }
  }
  return { agents, errors };
}

async function orcaTerminals() {
  const { stdout } = await run('orca', ['terminal', 'list', '--json'], {
    cwd: here, timeout: 12_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
  });
  const response = JSON.parse(stdout);
  if (!response.ok || !Array.isArray(response.result?.terminals)) throw new Error(response.error || 'Orca không trả danh sách terminal');
  return response.result.terminals;
}

async function processGroups() {
  if (process.platform !== 'win32') throw new Error('Chưa có bộ đo CPU/RAM cho hệ điều hành này');
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(here, 'process-sample.ps1')], {
    cwd: here, timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true,
  });
  const raw = JSON.parse(stdout);
  return { groups: Object.fromEntries(providers.map((name) => [name, {
    processCount: Number(raw.groups?.[name]?.processCount || 0),
    cpuPercent: Number(raw.groups?.[name]?.cpuPercent || 0),
    ramBytes: Number(raw.groups?.[name]?.ramBytes || 0),
  }])), machine: raw.machine };
}

function cooking(terminal) {
  if (!terminal?.connected) return false;
  const recent = Date.now() - Number(terminal.lastOutputAt || 0) < 90_000;
  if (!recent) return false;
  const preview = String(terminal.preview || '');
  if (/^[⠁-⣿]/u.test(String(terminal.title || '').trim())) return true;
  if (/Type your message or @path|Ask Devin to build features/i.test(preview)) return false;
  return /(?:Thinking…|Running tools|Channeling the Force)/i.test(preview);
}

export async function agentSnapshot(projects, safe) {
  const ledger = ledgerAgents(projects, safe);
  const [orca, processes] = await Promise.allSettled([orcaTerminals(), processGroups()]);
  const terminals = orca.status === 'fulfilled' ? orca.value : [];
  const byHandle = new Map(terminals.map((terminal) => [terminal.handle, terminal]));
  const linked = new Set();
  const agents = ledger.agents.map((agent) => {
    const terminal = byHandle.get(agent.terminal);
    if (terminal) linked.add(agent.terminal);
    const provider = agent.provider || providerOf(terminal?.agentIdentity);
    return { ...agent, provider, activity: !terminal ? (!agent.terminal || orca.status === 'rejected' ? 'unknown' : 'disconnected')
      : !terminal.connected ? 'disconnected' : cooking(terminal) ? 'cooking' : 'idle',
    connected: terminal?.connected ?? null, lastOutputAt: terminal?.lastOutputAt ?? null };
  });
  for (const terminal of terminals) {
    if (linked.has(terminal.handle) || !terminal.connected) continue;
    const provider = providerOf(terminal.agentIdentity);
    if (!provider) continue;
    const project = projectOf(projects, terminal.worktreePath);
    agents.push({ id: safe(terminal.handle), workflowId: null, workflowName: null,
      projectId: project?.id ?? null, projectName: project?.name ?? null, role: 'other', op: '', attempt: null,
      task: 'Terminal Orca không gắn với job StarCi đang chạy', cut: null, status: '',
      action: 'Terminal Orca không gắn với op StarCi đang chạy',
      provider, model: null, terminal: terminal.handle, since: null,
      activity: cooking(terminal) ? 'cooking' : 'idle', connected: true,
      lastOutputAt: terminal.lastOutputAt ?? null });
  }
  const groups = Object.fromEntries(providers.map((name) => [name, {
    ...(processes.status === 'fulfilled' ? processes.value.groups[name] : { processCount: null, cpuPercent: null, ramBytes: null }),
    terminals: agents.filter((agent) => agent.provider === name && agent.connected === true).length,
    cooking: agents.filter((agent) => agent.provider === name && agent.activity === 'cooking').length,
  }]));
  return { updatedAt: Date.now(), language: ownerLanguage(), agents: agents.sort((a, b) =>
    ({ cooking: 0, idle: 1, unknown: 2, disconnected: 3 })[a.activity] - ({ cooking: 0, idle: 1, unknown: 2, disconnected: 3 })[b.activity]),
  groups, machine: processes.status === 'fulfilled' ? processes.value.machine : null, sources: { ...ledger.errors,
    orca: orca.status === 'rejected' ? safe(orca.reason?.message || orca.reason) : null,
    processes: processes.status === 'rejected' ? safe(processes.reason?.message || processes.reason) : null } };
}

export function redactLogLine(value, limit = 240) {
  let line = String(value ?? '')
    .replace(/\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(line)) return '[đã ẩn khóa riêng]';
  line = line
    .replace(/\b(authorization|cookie|set-cookie)\s*:\s*.+/gi, '$1: [đã ẩn]')
    .replace(/(?<![?&])\b([\w-]*(?:token|secret|password|passwd|api[_-]?key|private[_-]?key|credential)[\w-]*\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi, '$1[đã ẩn]')
    .replace(/(?:sk|ghp|gho|xox[baprs]|AIza)[-_A-Za-z0-9]{12,}/g, '[đã ẩn]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{8,}/gi, 'Bearer [đã ẩn]')
    .replace(/\bBasic\s+[A-Za-z0-9+/=]{8,}/gi, 'Basic [đã ẩn]')
    .replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]*)?/g, '[đã ẩn JWT]')
    .replace(/([?&](?:token|key|secret|code|password|access_token|refresh_token|signature)=)[^&#\s]+/gi, '$1[đã ẩn]');
  return line.slice(0, limit);
}

export function summarizeLogEvents(lines, language = 'vi') {
  const events = [];
  const vi = language.startsWith('vi');
  for (let index = 0; index < lines.length; index++) {
    const line = String(lines[index] || '').trim();
    const next = String(lines[index + 1] || '').trim();
    const detail = /^[│|]?\s*\$\s+(.+)/.exec(next)?.[1]?.slice(0, 180) || '';
    if (/\bRunning command\b/i.test(line)) events.push({ kind: 'running', title: vi ? 'Đang chạy lệnh' : 'Running command', detail, line: index + 1 });
    else if (/\bRan command\b/i.test(line)) events.push({ kind: 'command', title: vi ? 'Đã chạy lệnh' : 'Ran command', detail, line: index + 1 });
    else if (/\bExited with code\s+0\b/i.test(line)) events.push({ kind: 'success', title: vi ? 'Lệnh hoàn tất thành công' : 'Command succeeded', detail: '', line: index + 1 });
    else if (/\bExited with code\s+([1-9]\d*)\b/i.test(line)) {
      const code = /\bExited with code\s+([1-9]\d*)\b/i.exec(line)?.[1];
      events.push({ kind: 'error', title: vi ? 'Lệnh kết thúc có lỗi' : 'Command failed', detail: vi ? `Mã thoát ${code}` : `Exit code ${code}`, line: index + 1 });
    } else if (/\b(?:Running tools|Thinking)[….\s]/i.test(line)) {
      const duration = /\b(\d+)m\s+(\d+)s\b/.exec(line);
      events.push({ kind: 'running', title: vi ? 'Agent đang xử lý' : 'Agent is working',
        detail: duration ? (vi ? `Đã hoạt động ${duration[1]} phút ${duration[2]} giây` : `Active ${duration[1]}m ${duration[2]}s`) : '', line: index + 1 });
    }
    else if (/\b(?:Edited|Wrote|Created) file\b/i.test(line)) events.push({ kind: 'change', title: vi ? 'Đã cập nhật tệp' : 'File updated', detail: '', line: index + 1 });
  }
  return events.slice(-16);
}

export async function readAgentLog(handle) {
  const { stdout } = await run('orca', ['terminal', 'read', '--terminal', handle, '--screen', '--limit', '80', '--json'], {
    cwd: here, timeout: 10_000, maxBuffer: 1024 * 1024, windowsHide: true,
  });
  const response = JSON.parse(stdout);
  if (!response.ok || !response.result?.terminal) throw new Error(response.error || 'Không đọc được terminal');
  const terminal = response.result.terminal;
  const tail = Array.isArray(terminal.tail) ? terminal.tail : [];
  const lines = tail.slice(-80).map(redactLogLine);
  const language = ownerLanguage();
  return {
    terminal: handle, updatedAt: Date.now(), source: terminal.source || 'unknown',
    language, lines, events: summarizeLogEvents(lines, language),
    limited: Boolean(terminal.limited || terminal.truncated),
  };
}
