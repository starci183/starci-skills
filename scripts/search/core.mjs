/**
 * core.mjs — the search engine behind scripts/search/*.
 *
 * WHY THIS EXISTS
 * A lookup table is only lean if the caller reads ONE ranked slice, not the whole file. Substring
 * matching returns hits in file order — the right row and a dozen wrong ones, unranked — so the model
 * either reads them all (the file back in context) or trusts the first, which is usually wrong. BM25
 * scores every row against the query and returns the top few, so the answer is first and the context
 * is three rows, not a hundred.
 *
 * WHAT IT DOES
 * - parses a CSV (quote-aware),
 * - tokenizes with a synonym map + stopword filter (so "dropdown"/"select" and "a11y"/"accessibility"
 *   land on the same token),
 * - ranks rows with BM25 over the columns declared searchable,
 * - returns the top-N rows projected to the columns worth printing, each cell truncated.
 *
 * The registry of what each domain's file is and which columns are searched vs printed is CONFIG.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".."); // .claude

/** Per-domain: where the data is, which columns BM25 indexes, which columns are printed. */
export const CONFIG = {
    component: {
        file: join(ROOT, "canon", "fe", "explore", "component", "data", "matrix.csv"),
        // NB: `dont_choose` is an ANTI-signal (what NOT to use). Indexing it made a row match the very
        // shape it warns against — dropped from search, kept in output. `you_have` is the shape; the
        // section names the family.
        // `keywords` is the row's own natural phrasings + synonyms, authored for search — it carries
        // the discriminating signal, so it is weighted (listed twice in the indexed text). `you_have`
        // is the shape, `choose` the component name; `dont_choose` stays out (an anti-signal).
        searchCols: ["keywords", "keywords", "you_have", "choose"],
        outputCols: ["id", "section", "choose", "entry_point", "dont_choose"],
    },
    tier: {
        file: join(ROOT, "scripts", "search", "data", "tiers.csv"),
        searchCols: ["tier", "owns", "signal_it_belongs_here", "signal_it_is_misplaced"],
        outputCols: ["tier", "owns", "never", "may_import"],
    },
};

const MAX_RESULTS = 3;
const TRUNCATE = 240;

// Words that carry no discrimination — dropping them keeps a loose query from scoring on "the".
const STOP = new Set("a an the of to in on for and or is are be with as at by it its this that not no you your i we they them he she".split(" "));
// Map surface variants onto one token so a query and the data meet even when they use different words.
const SYNONYM = {
    dropdown: "select", combobox: "select", menu: "select",
    a11y: "accessibility", i18n: "translation", l10n: "translation",
    modal: "dialog", popup: "dialog", overlay: "dialog",
    collapsible: "expandable", accordion: "expandable", disclosure: "expandable",
    tab: "tabs", carousel: "reel", slider: "reel",
    toast: "notification", snackbar: "notification", alert: "notification",
    avatar: "identity", chip: "tag", badge: "tag", pill: "tag",
    grid: "list", table: "list", feed: "list",
    button: "action", cta: "action", link: "action",
    loading: "skeleton", spinner: "skeleton", shimmer: "skeleton",
    pressable: "clickable", tappable: "clickable", href: "clickable",
};

/** lowercase → split on non-word → drop stopwords/short → map synonyms. */
export function tokenize(text) {
    return (text || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 1 && !STOP.has(w))
        .map((w) => SYNONYM[w] ?? w);
}

/** Quote-aware CSV parse → array of row objects keyed by the header. */
export function parseCsv(file) {
    const lines = readFileSync(file, "utf8").trim().split(/\r?\n/);
    const split = (line) => {
        const out = [];
        let cell = "", quoted = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (quoted && line[i + 1] === '"') { cell += '"'; i++; continue; }
                quoted = !quoted; continue;
            }
            if (ch === "," && !quoted) { out.push(cell); cell = ""; continue; }
            cell += ch;
        }
        out.push(cell);
        return out.map((c) => c.trim());
    };
    const head = split(lines[0]);
    return lines.slice(1).filter((l) => l.trim()).map((l) => {
        const cells = split(l);
        return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""]));
    });
}

/**
 * BM25 over a set of docs.
 * @param {string[]} docs one searchable string per row (the searchCols joined)
 */
class BM25 {
    constructor(docs, k1 = 1.5, b = 0.75) {
        this.k1 = k1; this.b = b;
        this.docs = docs.map(tokenize);
        this.N = this.docs.length;
        this.avgdl = this.docs.reduce((s, d) => s + d.length, 0) / (this.N || 1);
        // document frequency per term
        this.df = new Map();
        for (const d of this.docs) {
            for (const t of new Set(d)) this.df.set(t, (this.df.get(t) ?? 0) + 1);
        }
    }
    idf(term) {
        const n = this.df.get(term) ?? 0;
        return Math.log(1 + (this.N - n + 0.5) / (n + 0.5));
    }
    score(queryTokens, i) {
        const d = this.docs[i];
        const len = d.length;
        const tf = new Map();
        for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
        let s = 0;
        for (const q of queryTokens) {
            const f = tf.get(q) ?? 0;
            if (!f) continue;
            s += this.idf(q) * (f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * len / this.avgdl));
        }
        return s;
    }
}

/**
 * Rank a domain's rows against a query and return the top-N, projected + truncated.
 * @param {string} domain a key of CONFIG
 * @param {string} query natural language
 * @param {number} [n]
 * @returns {{rows: Array<Record<string,string>>, checked: number}}
 */
export function search(domain, query, n = MAX_RESULTS) {
    const cfg = CONFIG[domain];
    if (!cfg) throw new Error(`unknown domain: ${domain}. known: ${Object.keys(CONFIG).join(", ")}`);
    if (!existsSync(cfg.file)) throw new Error(`data file missing: ${cfg.file}`);
    const rows = parseCsv(cfg.file);
    const corpus = rows.map((r) => cfg.searchCols.map((c) => r[c] ?? "").join(" "));
    const bm25 = new BM25(corpus);
    const q = tokenize(query);
    const scored = rows
        .map((r, i) => ({ r, score: bm25.score(q, i) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, n);
    const trunc = (v) => (v.length > TRUNCATE ? v.slice(0, TRUNCATE) + "…" : v);
    return {
        checked: rows.length,
        rows: scored.map(({ r, score }) => {
            const out = { _score: score.toFixed(2) };
            for (const c of cfg.outputCols) out[c] = trunc(r[c] ?? "");
            return out;
        }),
    };
}
