#!/usr/bin/env node
// check-doc-owner.mjs — RT_DOC_NO_OWNER (rule R205): every tracked docs/*.md declares exactly one
// ownership header on its first line, and no two documents tell the same story twice.
//
//   Owner: <path>   the document explains a machine-owned source; the path names a knowledge/ or
//                   modules/ file or directory that exists — that source is the law, the document
//                   only reads it
//   Task: <task>    the document is a how-to; its task is unique — two documents never carry the
//                   same task line (normalized case and whitespace)
//
// One document, one owner: the header is the first line and the only Owner:/Task: line of the
// file. Duplication is refused twice over: no shared task, and no pair of documents whose titles
// share two or more topic words while at least 30% of the shorter document's sentences appear in
// the other — two such documents are one document merged, not two.
//
//   runs in the check stage (self-check doc-owner); --json prints the findings as JSON; --root <tree> judges another tree
// Exit 0 clean, 1 lists every finding as file or file pair, 2 bad arguments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles } from '../lib/walk.mjs';
import { lsFiles } from '../api/git/ls-files.mjs';
import { gitOutputOf } from '../lib/git.mjs';
import { isMain } from '../lib/is-main.mjs';
import { parseCheckArgs } from '../lib/check-scan.mjs';

const HELP = `Usage: check-doc-owner [--root <tree>] [--json]

Refuses a docs/*.md without exactly one ownership header on its first line
("Owner: <knowledge/|modules/ path that exists>" or "Task: <one task>"), a task
carried by two documents, or a document pair whose titles share two or more
topic words and whose sentences overlap at least 30%. Exit 0 clean, 1 lists
the findings, 2 is a bad argument.`;

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DOC_OWNER_MISSING = 'RT_DOC_NO_OWNER';
const DOC_DIR = 'docs';
const HEADER = /^(Owner|Task):[ \t]+(\S.*?)\s*$/;
const ANY_HEADER = /^(Owner|Task):/m;
const OWNER_ROOT = /^(?:knowledge|modules)\//;
/** Words that mark a form, not a topic ("the", "a", ...): they never count toward a shared title. */
const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'how', 'what', 'when', 'your', 'you', 'one', 'are', 'its', 'into', 'that', 'this', 'under', 'over', 'per', 'not', 'nor', 'via', 'out', 'all', 'any']);
/** A sentence shorter than this many words is a fragment, never an overlap signal. */
const MIN_SENTENCE_WORDS = 4;
/** The share of the shorter document's sentences that must appear in the other to be one document. */
const OVERLAP_RATIO = 0.3;
/** The number of title topic words two documents may share before their sentences are compared. */
const SHARED_TOPIC_WORDS = 2;

/** The tracked Markdown documents of `root`'s docs/ (repository-relative POSIX paths); the filesystem when `root` is no Git work tree. */
export function docFiles(root = DEFAULT_ROOT) {
  const isDoc = (rel) => /^docs\/.+\.md$/.test(rel);
  try {
    return gitOutputOf(lsFiles(['-z', '--', DOC_DIR], { dir: root }), 'git ls-files').split('\0').filter(Boolean)
      .map((f) => f.replaceAll('\\', '/')).filter((rel) => isDoc(rel) && fs.existsSync(path.join(root, ...rel.split('/')))).sort();
  } catch {
    const dir = path.join(root, DOC_DIR);
    return fs.existsSync(dir) ? walkFiles(dir, { sorted: true, filter: (name) => name.endsWith('.md') }).map((f) => path.relative(root, f).replaceAll('\\', '/')) : [];
  }
}

/** One document's parts: {rel, header: {kind, value} | null, headerCount, title, topics, sentences}. */
function readDocument(root, rel) {
  const lines = fs.readFileSync(path.join(root, ...rel.split('/')), 'utf8').split('\n');
  const first = lines.find((line) => line.trim() !== '') ?? '';
  const match = HEADER.exec(first);
  return {
    rel,
    header: match ? { kind: match[1], value: match[2] } : null,
    headerCount: lines.filter((line) => /^(Owner|Task):/.test(line)).length,
    title: (lines.find((line) => /^#\s+/.test(line)) ?? '').replace(/^#\s+/, '').trim(),
    topics: topicWords(lines.find((line) => /^#\s+/.test(line)) ?? ''),
    sentences: sentences(textBody(lines)),
  };
}

/** The prose of a document with code fences, the header line and headings removed (sentence material). */
function textBody(lines) {
  const kept = [];
  let fenced = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
    if (fenced || /^(Owner|Task):/.test(line) || /^\s*#/.test(line)) continue;
    kept.push(line);
  }
  return kept.join(' ');
}

/** The title's topic words: lowercase alphanumeric words of three or more letters, stop words dropped. */
function topicWords(title) {
  return new Set(String(title).toLowerCase().match(/[a-z][a-z0-9-]*/g)?.filter((w) => w.length >= 3 && !STOP_WORDS.has(w)) ?? []);
}

/** The document's normalized prose sentences of MIN_SENTENCE_WORDS or more words, as a set. */
export function sentences(body) {
  const out = new Set();
  const normalized = String(body)
    .replace(/\[[^\]]*\]\(([^)]*)\)/g, ' $1 ')
    .replace(/[`*_>|\[\]()#]/g, ' ')
    .replace(/\s+/g, ' ');
  for (const s of normalized.split(/(?<=[.!?])\s+|(?<=\|)\s+/)) {
    const words = s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (words.split(' ').filter(Boolean).length >= MIN_SENTENCE_WORDS) out.add(words);
  }
  return out;
}

/** The shared topic words of two documents. */
const sharedTopics = (a, b) => [...a.topics].filter((w) => b.topics.has(w));

/** How many of `a`'s sentences also appear in `b`, as a share of the smaller set. */
const overlap = (a, b) => {
  if (!a.sentences.size || !b.sentences.size) return { shared: 0, ratio: 0 };
  const shared = [...a.sentences].filter((s) => b.sentences.has(s)).length;
  return { shared, ratio: shared / Math.min(a.sentences.size, b.sentences.size) };
};

/** A task text compared across documents: lowercase, whitespace collapsed. */
const taskKey = (value) => value.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * The findings of `root`: one per document problem ({path}) and one per duplicated pair ({path, other}).
 * [{code: RT_DOC_NO_OWNER, path, other?, message}]
 */
export function docOwnerFindings(root = DEFAULT_ROOT) {
  const findings = [];
  const add = (rel, message, other) => findings.push({ code: DOC_OWNER_MISSING, path: rel, ...(other ? { other } : {}), message });
  const docs = docFiles(root).map((rel) => readDocument(root, rel));
  const byTask = new Map();
  for (const doc of docs) {
    if (!doc.header) {
      add(doc.rel, `${doc.rel}: the first non-empty line is not "Owner: <knowledge/|modules/ path>" or "Task: <one task>"`);
    } else {
      if (doc.headerCount !== 1) add(doc.rel, `${doc.rel}: ${doc.headerCount} Owner:/Task: lines; a document carries exactly one`);
      if (doc.header.kind === 'Owner') {
        if (!OWNER_ROOT.test(doc.header.value)) add(doc.rel, `${doc.rel}: Owner names "${doc.header.value}", which is not under knowledge/ or modules/`);
        else if (!fs.existsSync(path.join(root, ...doc.header.value.split('/')))) add(doc.rel, `${doc.rel}: Owner names ${doc.header.value}, which does not exist`);
      } else {
        const key = taskKey(doc.header.value);
        if (!key) add(doc.rel, `${doc.rel}: the Task line names no task`);
        else if (byTask.has(key)) add(doc.rel, `${doc.rel} and ${byTask.get(key)} carry the same task "${doc.header.value}"; one task has one document`, byTask.get(key));
        else byTask.set(key, doc.rel);
      }
    }
    if (!doc.title) add(doc.rel, `${doc.rel}: no "# " title; a document names what it is`);
  }
  for (let i = 0; i < docs.length; i += 1) {
    for (let j = i + 1; j < docs.length; j += 1) {
      const [a, b] = [docs[i], docs[j]];
      const topics = sharedTopics(a, b);
      if (topics.length < SHARED_TOPIC_WORDS) continue;
      const { shared, ratio } = overlap(a, b);
      if (ratio >= OVERLAP_RATIO) {
        add(a.rel, `${a.rel} and ${b.rel} share the title words ${topics.join(', ')} and ${shared} sentence(s) (${Math.round(ratio * 100)}% of the shorter document); merge them — one story has one document`, b.rel);
      }
    }
  }
  return findings;
}

export function checkDocOwnerMain(argv) {
  const parsed = parseCheckArgs(argv, { name: 'check-doc-owner', help: HELP, root: DEFAULT_ROOT });
  if (parsed.exitCode !== undefined) return parsed;
  const { root, json } = parsed;
  const findings = docOwnerFindings(root);
  if (json) return { exitCode: findings.length ? 1 : 0, text: `${JSON.stringify({ schema: 'starci/doc-owner@1', ok: findings.length === 0, filesScanned: docFiles(root).length, findings }, null, 2)}\n` };
  if (!findings.length) return { exitCode: 0, text: `check-doc-owner: ${docFiles(root).length} documents, every one owned, no duplicate\n` };
  const lines = [`check-doc-owner: ${findings.length} finding(s) (${DOC_OWNER_MISSING})`];
  for (const f of findings) lines.push(`  ${f.message}`);
  return { exitCode: 1, text: `${lines.join('\n')}\n` };
}

if (isMain(import.meta.url)) {
  const result = checkDocOwnerMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
