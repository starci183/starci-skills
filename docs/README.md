# docs/ — Docusaurus render of the canon

Renders `.claude/` (canon/, skills/, the loose docs) **in place** via `docs.path: '..'` — no copy, no
sync. The source of truth stays in `canon/` and `skills/`; this site only points at it, so a new canon
file appears in the sidebar the moment it exists.

```bash
cd .claude/docs
npm install
npm start   # → localhost:3030
```

Edit docs = edit the `.md` under `.claude/**`. Do not write canon content inside `docs/`.
