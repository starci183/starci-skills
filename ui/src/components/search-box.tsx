import { useEffect, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { StateChip } from './state-chip';
import { navigate } from '../router';
import type { Ref, UiState } from '../contract';
import type { Concept } from './concept';

export const concept: Concept = 'frame';
type Hit = Ref & { title: string; ui: UiState };

export function SearchBox() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen((value) => !value); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open || !query.trim()) { setHits([]); setLoading(false); setError(null); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.json() as { data: { hits: Hit[] } };
        setHits(body.data.hits.filter((hit) => hit.href.startsWith('#/')));
        setSelected(0);
        setError(null);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Không tìm được ID.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 180);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, query]);

  const choose = (hit: Hit) => { navigate(hit.href); setOpen(false); };
  return <>
    <Button variant="outline" className="shell-search-trigger" onClick={() => setOpen(true)} aria-label="Tìm ID hoặc bằng chứng">
      <Search className="size-4" aria-hidden="true" /><span>Tìm ID hoặc bằng chứng</span><kbd>⌘ K</kbd>
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="search-dialog">
        <DialogHeader><DialogTitle>Tìm trong StarCi</DialogTitle><DialogDescription>Dán ID workflow, unit, attempt, quyết định hoặc blob.</DialogDescription></DialogHeader>
        <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nhập ID hoặc từ khóa…" aria-label="Từ khóa tìm kiếm"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setSelected((value) => Math.min(value + 1, hits.length - 1)); }
            if (event.key === 'ArrowUp') { event.preventDefault(); setSelected((value) => Math.max(0, value - 1)); }
            if (event.key === 'Enter' && hits[selected]) { event.preventDefault(); choose(hits[selected]); }
          }} />
        <div className="search-results" role="listbox" aria-label="Kết quả tìm kiếm">
          {!query.trim() && <p>Nhập một ID để mở bằng chứng tương ứng.</p>}
          {loading && <p>Đang tìm…</p>}
          {error && <p role="alert">Không đọc được tìm kiếm: {error}</p>}
          {!loading && !error && query.trim() && hits.length === 0 && <p>Không có kết quả phù hợp.</p>}
          {hits.map((hit, index) => <button key={`${hit.kind}:${hit.project ?? ''}:${hit.id}`} type="button" role="option" aria-selected={index === selected}
            className="search-hit" onMouseEnter={() => setSelected(index)} onClick={() => choose(hit)}>
            <span><strong>{hit.title}</strong><small>{hit.kind} · {hit.id}</small></span>
            <StateChip state={hit.ui} compact /><ArrowRight className="size-4" aria-hidden="true" />
          </button>)}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
