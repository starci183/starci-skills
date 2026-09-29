import type { EvidenceFile } from '../../contract';
import type { Concept } from '../concept';

export const concept: Concept = 'C8';

/** S7 renderers. Text comes already decoded (server converts UTF-16/BOM to UTF-8). */
export function JsonView({ text }: { text: string }) { return <pre className="whitespace-pre-wrap text-xs">{text}</pre>; }
export function YamlView({ text }: { text: string }) { return <pre className="whitespace-pre-wrap text-xs">{text}</pre>; }
export function MarkdownView({ text }: { text: string }) { return <pre className="whitespace-pre-wrap text-xs">{text}</pre>; }
export function TextView({ text, query }: { text: string; query: string }) { void query; return <pre className="whitespace-pre-wrap text-xs">{text}</pre>; }
export function DiffTextView({ text }: { text: string }) { return <pre className="whitespace-pre-wrap text-xs">{text}</pre>; }
export function ImageView({ file }: { file: EvidenceFile }) { return <img src={file.href} alt={file.name} className="max-h-96" />; }
export function VideoView({ file }: { file: EvidenceFile }) { return <video src={file.href} controls preload="metadata" className="max-h-96 w-full" />; }
