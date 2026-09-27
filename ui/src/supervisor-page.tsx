import { useEffect, useState } from 'react';
import { ArrowRight, Cpu, HardDrive, Radio, ShieldAlert } from 'lucide-react';
import type { AgentSnapshot, Snapshot } from './types';
import { LogTimeline } from './log-timeline';
import { missionLead, SupervisorMissionSections, useSupervisorState } from './supervisor-mission';

const stamp = (value: number | string | null | undefined) => value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(value)) : 'Chưa có dữ liệu';
const minutes = (value: number | null) => value == null ? 'Chưa có dữ liệu' : value < 60 ? `${value} phút` : `${Math.floor(value / 60)} giờ ${value % 60} phút`;
const bytes = (value: number) => `${(value / 1024 ** 3).toFixed(1)} GB`;
const sourceNote = (name: string, at: number | null | undefined) => <span className="text-[11px] text-zinc-500">Nguồn: {name} · {stamp(at)}</span>;
const missing = (what: string) => <p className="text-sm leading-6 text-zinc-500">Chưa có dữ liệu. {what}</p>;

export function SupervisorPage({ data, agents }: { data: Snapshot; agents: AgentSnapshot | null }) {
  const sup = data.supervisor;
  const { state: mission, error: missionError } = useSupervisorState();
  const [samples, setSamples] = useState<{ at: number; cpu: number; ram: number }[]>([]);
  useEffect(() => {
    if (!agents?.machine) return;
    setSamples((old) => [...old.filter((sample) => sample.at !== agents.updatedAt), { at: agents.updatedAt, cpu: agents.machine!.cpu.percent, ram: agents.machine!.memory.percent }].slice(-2));
  }, [agents]);
  const health = agents?.machine;
  const trend = (key: 'cpu' | 'ram') => samples.length < 2 ? 'Chưa có dữ liệu' : samples[1][key] > samples[0][key] ? 'Tăng' : samples[1][key] < samples[0][key] ? 'Giảm' : 'Không đổi';
  const urgent = mission ? undefined : data.owed[0];
  const missionUrgent = mission?.owed.items[0];
  const unread = mission ? mission.messages.inbox.find((message) => !message.read) : data.inbox.find((message) => !message.read);
  const urgentLead = urgent && /uat\.verify/i.test(urgent.summary) && /owner decides/i.test(urgent.summary)
    ? 'Cần quyết định có chạy lại kiểm thử UAT hay không.'
    : 'Supervisor đang theo dõi một việc còn mở.';
  const status = mission?.seat.state === 'live' ? 'live' : mission?.seat.state === 'expired' ? 'stale' : sup?.seat?.status ?? 'off';
  const mode = mission?.seat.mode ?? sup?.mode;
  const seatText = !mode ? 'Chưa có dữ liệu' : mode === 'chat' ? `Kênh trao đổi · ${status === 'live' ? 'đang kết nối' : status === 'stale' ? 'tín hiệu cũ' : 'chưa đăng ký'}` : `Supervisor · ${status === 'live' ? 'đang hoạt động' : status === 'stale' ? 'tín hiệu cũ' : 'đang tắt'}`;
  return <div className="min-w-0 space-y-7">
    <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-none sm:p-6" aria-labelledby="supervisor-seat">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400"><ShieldAlert className="size-4 text-zinc-300" /><span>Trạng thái Supervisor</span><span className={`rounded-full border px-2 py-0.5 ${status === 'live' ? 'border-emerald-500/30 text-emerald-300' : status === 'stale' ? 'border-amber-500/30 text-amber-300' : 'border-zinc-700 text-zinc-400'}`}>{status === 'live' ? 'Có tín hiệu' : status === 'stale' ? 'Tín hiệu cũ' : 'Tắt / chưa đăng ký'}</span></div>
      <h2 id="supervisor-seat" className="mt-3 break-words text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">{seatText}</h2>
      <p className="mt-2 text-sm text-zinc-400">{mode === 'kernel' ? `${mission?.seat.agent ?? sup?.seat?.agent ?? 'Chưa rõ tác nhân'} · ${mission?.seat.model ?? sup?.seat?.model ?? 'Chưa rõ mô hình'} · ${mission?.seat.since || sup?.seat?.startedAt ? `chạy ${minutes(Math.max(0, Math.round((Date.now() - (mission?.seat.since || sup?.seat?.startedAt || Date.now())) / 60_000)))} · từ ${stamp(mission?.seat.since || sup?.seat?.startedAt)}` : 'Chưa có dữ liệu thời gian chạy'}` : mode === 'chat' ? 'Supervisor vận hành qua kênh trao đổi. Chưa có tiến trình riêng.' : 'Chưa có dữ liệu chế độ Supervisor.'}</p>
      {sourceNote(mode === 'chat' ? 'kênh Supervisor' : 'trạng thái giám sát', mission?.at ?? sup?.seat?.heartbeatAt)}
      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Việc cần chú ý trước</div>
        {missionUrgent ? <div className="mt-1">
          <p className="text-sm font-medium leading-6 text-zinc-100">{missionLead(missionUrgent)}</p>
          <p className="mt-1 text-xs text-zinc-400">Đã mở {minutes(missionUrgent.ageMin)} · {missionUrgent.breach ? 'Quá hạn xử lý' : 'Trong hạn xử lý'}</p>
          <p className="mt-1 text-xs text-zinc-400">{mission.actions.some((action) => action.item === missionUrgent.key) ? 'Đã ghi nhận hành động' : 'Chưa ghi nhận hành động'}</p>
          <details className="mt-2 text-xs text-zinc-400"><summary className="cursor-pointer text-sky-400">Xem bằng chứng gốc</summary><p className="mt-2 whitespace-pre-wrap break-words">{missionUrgent.evidence}</p><p className="mt-2 whitespace-pre-wrap break-words">{missionUrgent.do}</p></details>
          {missionUrgent.workflowId && <a className="mt-2 inline-flex items-center gap-1 text-xs text-sky-400 hover:underline" href={`#/workflows/${encodeURIComponent(missionUrgent.workflowId)}`}>Mở luồng việc <ArrowRight className="size-3" /></a>}
        </div> : urgent ? <div className="mt-1">
          <p className="text-sm font-medium leading-6 text-zinc-100">{urgentLead}</p><p className="mt-1 text-xs text-zinc-400">Đã mở {minutes(urgent.ageMin)} · {urgent.action ? 'Đã ghi nhận hướng xử lý' : 'Chưa ghi nhận hướng xử lý'}</p>
          <details className="mt-2 text-xs text-zinc-400"><summary className="cursor-pointer text-sky-400">Xem nội dung gốc</summary><p className="mt-2 whitespace-pre-wrap break-words">{urgent.summary}</p>{urgent.action && <p className="mt-2 whitespace-pre-wrap break-words">{urgent.action}</p>}</details>
          {urgent.projectId && <a className="mt-2 inline-flex items-center gap-1 text-xs text-sky-400 hover:underline" href={`#/workflows/${encodeURIComponent(urgent.workflowId)}`}>Mở luồng việc <ArrowRight className="size-3" /></a>}
        </div> : mission?.tick?.owed ? <p className="mt-1 text-sm leading-6 text-zinc-100">Lần cập nhật gần nhất ghi {mission.tick.owed} việc cần xử lý. Chưa có danh sách chi tiết để xác định việc ưu tiên.</p> : unread ? <div className="mt-1"><p className="text-xs text-zinc-500">Thư chưa đọc · {stamp(unread.at)}</p><p className="mt-1 text-sm font-medium leading-6 text-zinc-100">Có thư gửi đến Supervisor cần đọc.</p><button type="button" onClick={() => document.getElementById('sup-messages')?.scrollIntoView({ behavior: 'smooth' })} className="mt-2 inline-flex items-center gap-1 text-xs text-sky-400 hover:underline">Xem tin nhắn <ArrowRight className="size-3" /></button></div> : <p className="mt-1 text-sm text-zinc-400">Không có việc còn mở hoặc thư chưa đọc trong dữ liệu hiện tại.</p>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-zinc-800 p-3"><p className="text-xs text-zinc-500">Thứ tự xử lý hiện tại</p>{missing('Hệ thống chưa cung cấp thứ tự xử lý.')}</div>
        <div className="min-w-0 rounded-xl border border-zinc-800 p-3"><p className="text-xs text-zinc-500">Giới hạn việc chạy song song</p>{missing('Hệ thống chưa cung cấp giới hạn chung.')}{sup?.workerCap && <details className="mt-1 text-xs text-zinc-400"><summary className="cursor-pointer text-sky-400">Giới hạn riêng của Supervisor: {sup.workerCap.cap}</summary><p className="mt-1 break-words">{sup.workerCap.reason}</p></details>}</div>
        <div className="min-w-0 rounded-xl border border-zinc-800 p-3"><p className="flex items-center gap-1 text-xs text-zinc-500"><Cpu className="size-3" /> CPU host</p><p className="mt-1 text-xl font-semibold">{health ? `${health.cpu.percent.toFixed(0)}%` : 'Chưa có dữ liệu'}</p><p className="text-xs text-zinc-500">Xu hướng: {trend('cpu')}</p></div>
        <div className="min-w-0 rounded-xl border border-zinc-800 p-3"><p className="flex items-center gap-1 text-xs text-zinc-500"><HardDrive className="size-3" /> RAM host</p><p className="mt-1 text-xl font-semibold">{health ? `${bytes(health.memory.usedBytes)} / ${bytes(health.memory.totalBytes)}` : 'Chưa có dữ liệu'}</p><p className="text-xs text-zinc-500">{health ? `${health.memory.percent.toFixed(0)}% · ` : ''}Xu hướng: {trend('ram')}</p></div>
      </div>
      <p className="mt-3 text-[11px] text-zinc-500">Số liệu máy: /api/agents · {stamp(agents?.updatedAt)}. Xu hướng chỉ có khi trình duyệt đã nhận hai mẫu đo.</p>
    </section>

    <SupervisorMissionSections state={mission} error={missionError} />
    <section aria-labelledby="sup-health"><div className="mb-3 flex items-center gap-2"><Radio className="size-4 text-zinc-400" /><h2 id="sup-health" className="text-lg font-semibold">Sức khỏe các bước</h2></div><div className="rounded-xl border border-dashed border-zinc-800 p-5">{missing('Nguồn thống kê các bước chưa có trong dữ liệu hiện tại. Xu hướng cần ít nhất hai mẫu đo.')}</div></section>
    <section aria-labelledby="sup-log"><h2 id="sup-log" className="mb-2 text-lg font-semibold">Nhật ký máy Supervisor</h2><p className="mb-3 text-xs text-zinc-500">Nguồn: bảng logs của wf-supervisor · chỉ đọc, theo dõi dòng mới khi bật.</p><LogTimeline projectId="supervisor" workflowId="wf-supervisor" jobIds={[]} endpoint="/api/supervisor/logs" /></section>
    <section aria-label="Nguồn dữ liệu" className="rounded-xl border border-zinc-800 p-4"><h2 className="text-sm font-semibold">Nguồn và độ mới</h2><p className="mt-1 text-xs text-zinc-500">Snapshot {stamp(data.updatedAt)} · Supervisor tick cuối {stamp(sup?.ticks?.[0]?.at)}</p>{Object.entries(data.sources).filter(([, error]) => error).map(([name, error]) => <p className="mt-2 break-words text-xs text-amber-300" key={name}>{name}: {error}</p>)}</section>
  </div>;
}
