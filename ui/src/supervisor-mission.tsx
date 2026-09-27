import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Clock3, Inbox } from 'lucide-react';
import type { OwedAction, SupervisorActionRecord, SupervisorState } from './contract';

const when = (value: number | string | null | undefined) => value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'Chưa có dữ liệu';
const age = (minutes: number) => minutes < 60 ? `${minutes} phút` : `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
const classNameOf = (value: string) => ({ 'runtime-defect': 'Hệ thống gặp lỗi', 'fixed-defect': 'Bản sửa cần kiểm tra', 'retry-cap': 'Đã hết lượt thử lại', 'stale-gate': 'Chặng bị giữ quá lâu', 'owner-gate-no-ask': 'Cần quyết định nhưng chưa có câu hỏi', 'owner-ask': 'Đang chờ câu trả lời', 'peer-wait': 'Đang chờ luồng khác', 'unread-peer': 'Có thư chưa đọc', undispatched: 'Việc chưa được giao', 'dead-worker': 'Tác nhân đã dừng', 'dead-kernel': 'Luồng xử lý đã dừng', orphaned: 'Việc mất người phụ trách', stalled: 'Việc đang đứng yên', 'contract-stale': 'Quy định đã thay đổi', 'experiment-revert': 'Cần hoàn tác thử nghiệm', 'push-refused': 'Đưa thay đổi lên nhánh chính bị từ chối' }[value] ?? 'Có việc cần xử lý');
const actionName = (value: string) => value.startsWith('notify') ? 'Đã gửi thông báo' : value === 'resolve' ? 'Đã giải quyết' : value.startsWith('revert') ? 'Đã hoàn tác' : 'Đã ghi nhận hành động';
const experimentName = (value: string) => ({ measuring: 'Đang đo', 'revert-due': 'Cần hoàn tác', kept: 'Đã giữ', reverted: 'Đã hoàn tác', 'did-not-work': 'Chưa hiệu quả' }[value] ?? 'Chưa rõ trạng thái');

export function useSupervisorState() {
  const [state, setState] = useState<SupervisorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/supervisor/state', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const next = await response.json() as SupervisorState;
        if (next.schema !== 'starci/supervisor-state@1') throw new Error('Sai định dạng dữ liệu');
        setState(next);
        setError(null);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setState(null);
        setError(cause instanceof Error ? cause.message : 'Không đọc được dữ liệu');
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => { window.clearInterval(timer); controller.abort(); };
  }, []);
  return { state, error };
}

export function missionLead(item: OwedAction) {
  return classNameOf(item.class);
}

function Item({ item, action }: { item: OwedAction; action: SupervisorActionRecord | undefined }) {
  return <li className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium text-zinc-100">{classNameOf(item.class)}</p><span className={`rounded-full border px-2 py-0.5 text-[11px] ${item.breach ? 'border-amber-500/30 text-amber-300' : 'border-zinc-700 text-zinc-400'}`}>{item.breach ? 'Quá hạn xử lý' : 'Trong hạn xử lý'}</span></div>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400"><span>Đã mở {age(item.ageMin)}</span><span>Thời hạn: {item.breach ? 'Đã quá hạn' : 'Chưa quá hạn'}</span></div>
    <p className="mt-2 text-sm text-zinc-300">{action ? `${actionName(action.action)} lúc ${when(action.at)}` : 'Chưa ghi nhận hành động.'}</p>
    {item.workflowId && <a className="mt-2 inline-flex items-center gap-1 text-xs text-sky-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400" href={`#/workflows/${encodeURIComponent(item.workflowId)}`}>Mở luồng việc <ArrowRight className="size-3" /></a>}
    <details className="mt-2 text-xs text-zinc-500"><summary className="cursor-pointer text-sky-400">Xem bằng chứng và hướng xử lý gốc</summary><p className="mt-2 whitespace-pre-wrap break-words">{item.evidence}</p><p className="mt-2 whitespace-pre-wrap break-words">{item.do}</p>{action?.reason && <p className="mt-2 whitespace-pre-wrap break-words">{action.reason}</p>}</details>
  </li>;
}

function today(at: number) {
  const date = new Date(at).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const current = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  return date === current;
}

type MessageRow = { id: string; at: string; from: string; to: string; text: string; ok: boolean; incoming: boolean };
function MessageItem({ message }: { message: MessageRow }) {
  return <li className={`min-w-0 rounded-xl border p-3 sm:max-w-[85%] ${message.incoming ? 'border-zinc-800 bg-zinc-950/80' : 'ml-auto border-sky-900/60 bg-sky-950/20'}`}>
    <div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-500"><span>{message.from} → {message.to}{!message.ok && ' · gửi chưa thành công'}</span><time dateTime={message.at}>{when(message.at)}</time></div>
    <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-300">{message.text}</p>
    {message.text.length > 180 && <details className="mt-2 text-xs text-zinc-400"><summary className="cursor-pointer text-sky-400">Xem toàn bộ tin nhắn</summary><p className="mt-2 whitespace-pre-wrap break-words">{message.text}</p></details>}
  </li>;
}

export function SupervisorMissionSections({ state, error }: { state: SupervisorState | null; error: string | null }) {
  const items = state?.owed.items ?? [];
  const resolved = state?.actions.filter((action) => action.action === 'resolve' && today(action.at)) ?? [];
  const messages = state ? [
    ...state.messages.inbox.map((message) => ({ id: `in-${message.id}`, at: message.at, from: message.from || 'Nguồn chưa rõ', to: 'Supervisor', text: message.text, ok: true, incoming: true })),
    ...state.messages.outbox.map((message) => ({ id: `out-${message.id}`, at: message.at, from: 'Supervisor', to: message.to || 'Người nhận chưa rõ', text: message.text, ok: message.ok, incoming: false })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 30) : [];
  const unavailable = error ? `Chưa đọc được trạng thái Supervisor (${error}).` : 'Đang đọc trạng thái Supervisor.';
  return <>
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <section aria-labelledby="sup-working" className="min-w-0"><div className="mb-3 flex items-center gap-2"><Clock3 className="size-4 text-amber-300" /><h2 id="sup-working" className="text-lg font-semibold">Đang xử lý</h2>{state && <span className="text-xs text-zinc-500">{items.length} bản ghi</span>}</div><p className="mb-3 text-xs text-zinc-500">Nguồn: trạng thái Supervisor · {when(state?.owed.at)}. Hành động chỉ hiện khi đã có bản ghi.</p>{!state ? <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">{unavailable}</p> : items.length ? <><ol className="space-y-2">{items.slice(0, 8).map((item) => <Item key={item.key} item={item} action={state.actions.find((action) => action.item === item.key)} />)}</ol>{items.length > 8 && <details className="mt-3 rounded-xl border border-zinc-800 p-3"><summary className="cursor-pointer text-sm text-sky-400">Xem thêm {items.length - 8} việc đang xử lý</summary><ol className="mt-3 space-y-2">{items.slice(8).map((item) => <Item key={item.key} item={item} action={state.actions.find((action) => action.item === item.key)} />)}</ol></details>}</> : <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">{state.tick?.owed ? `Lần cập nhật gần nhất ghi ${state.tick.owed} việc cần xử lý, nhưng nguồn chưa có danh sách chi tiết.` : 'Không có việc còn mở trong lần cập nhật này.'}</p>}</section>
      <section aria-labelledby="sup-done" className="min-w-0"><h2 id="sup-done" className="mb-3 text-lg font-semibold">Đã xử lý hôm nay</h2>{!state ? <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">{unavailable}</p> : resolved.length ? <ol className="space-y-2">{resolved.map((action, index) => <li key={`${action.item}-${action.at}-${index}`} className="rounded-xl border border-zinc-800 p-4"><p className="text-sm font-medium">Đang chờ xử lý → Đã giải quyết</p><p className="mt-1 text-xs text-zinc-400">{when(action.at)}</p>{action.workflowId && <a className="mt-2 inline-flex items-center gap-1 text-xs text-sky-400 hover:underline" href={`#/workflows/${encodeURIComponent(action.workflowId)}`}>Mở luồng việc <ArrowRight className="size-3" /></a>}<details className="mt-2 text-xs text-zinc-500"><summary className="cursor-pointer text-sky-400">Xem lý do ghi nhận</summary><p className="mt-2 whitespace-pre-wrap break-words">{action.reason || action.item}</p></details></li>)}</ol> : <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">Chưa có bản ghi giải quyết hôm nay.</p>}</section>
    </div>
    <section aria-labelledby="sup-messages">
      <div className="mb-3 flex items-center gap-2"><Inbox className="size-4 text-zinc-400" /><h2 id="sup-messages" className="text-lg font-semibold">Tin nhắn</h2></div>
      <p className="mb-3 text-xs text-zinc-500">Nguồn: thư đến và thư đi của Supervisor · {when(state?.at)}. Trang chỉ đọc và không đánh dấu thư đã xem.</p>
      {!state ? <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">{unavailable}</p> : messages.length ? <>
        <ol className="space-y-2">{messages.slice(0, 6).map((message) => <MessageItem key={message.id} message={message} />)}</ol>
        {messages.length > 6 && <details className="mt-3 rounded-xl border border-zinc-800 p-3"><summary className="cursor-pointer text-sm text-sky-400">Xem thêm {messages.length - 6} tin nhắn cũ</summary><ol className="mt-3 space-y-2">{messages.slice(6).map((message) => <MessageItem key={message.id} message={message} />)}</ol></details>}
      </> : <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">Chưa có thư trong dữ liệu hiện tại.</p>}
    </section>
    <section aria-labelledby="sup-learning"><div className="mb-3 flex items-center gap-2"><BookOpen className="size-4 text-zinc-400" /><h2 id="sup-learning" className="text-lg font-semibold">Sổ tự học</h2></div>{!state ? <p className="rounded-xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-500">{unavailable}</p> : <div className="grid gap-4 xl:grid-cols-2"><div className="space-y-2"><h3 className="text-sm font-medium text-zinc-300">Giả thuyết và thử nghiệm</h3>{state.learning.experiments.length ? state.learning.experiments.slice(-6).reverse().map((experiment) => <article key={experiment.id} className="rounded-xl border border-zinc-800 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium">{experiment.signature}</p><span className="text-xs text-zinc-400">{experimentName(experiment.status)}</span></div><p className="mt-2 text-xs text-zinc-400">{state.learning.hypotheses.find((hypothesis) => hypothesis.signature === experiment.signature)?.symptom || 'Chưa có mô tả giả thuyết.'}</p><p className="mt-2 text-xs text-zinc-400">Bản sửa: {experiment.lane || 'Chưa có bản sửa'}{experiment.commits.length ? ` · ${experiment.commits.join(', ')}` : ''}</p><p className="mt-1 text-xs text-zinc-400">Hiệu quả: {experiment.result || 'Chưa có kết quả đo.'}</p></article>) : <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">Chưa có thử nghiệm được ghi nhận.</p>}</div><div className="space-y-2"><h3 className="text-sm font-medium text-zinc-300">Bài học và đề xuất</h3>{state.learning.lessons.slice(-6).reverse().map((lesson, index) => <article key={`${lesson.at}-${index}`} className="rounded-xl border border-zinc-800 p-4"><p className="text-sm text-zinc-200">{lesson.text}</p><p className="mt-2 text-xs text-zinc-500">{lesson.source === 'owner' ? 'Thầy góp ý' : 'Supervisor tự rút ra'} · {when(lesson.at)} · {lesson.status === 'reverted' ? 'Đã hoàn tác' : lesson.status === 'kept' ? 'Đã giữ' : 'Đã ghi nhận'}</p></article>)}{state.learning.proposals.filter((proposal) => proposal.status === 'open').map((proposal) => <article key={proposal.id} className="rounded-xl border border-amber-500/25 bg-amber-950/10 p-4"><p className="text-xs text-amber-300">Đề xuất chờ thầy</p><p className="mt-1 text-sm font-medium">{proposal.title}</p><p className="mt-2 text-xs text-zinc-400">Bằng chứng: {proposal.evidence || 'Chưa có dữ liệu.'}</p><p className="mt-2 text-xs text-zinc-400">Lựa chọn: {proposal.options || 'Chưa có dữ liệu.'}</p><p className="mt-2 text-xs text-zinc-400">Supervisor đề xuất: {proposal.recommendation}.</p><p className="mt-2 text-xs text-zinc-400">Trả lời qua câu hỏi đang mở hoặc Telegram.</p></article>)}{!state.learning.lessons.length && !state.learning.proposals.length && <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">Chưa có bài học hoặc đề xuất được ghi nhận.</p>}</div></div>}</section>
  </>;
}
