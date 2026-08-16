# StarCi Skills Docs — Nextra

Nextra auto-discovers standardized modules under `.claude/fe/{design,senses,governance}` and
renders their public records:

```text
<concept>/
├─ INDEX.md   # compact English rules for AI
├─ prompt.md  # plain request → semantic className reasoning
├─ vi.md      # Vietnamese human guide
├─ example.md # generic scenarios + UI/Code tabs
├─ audit.md   # advisory critique
└─ changelog.md # version history
```

All six records are published. The generated `content/` directory is ignored; run the sync command
after changing a source record.

```bash
cd .claude/docs
npm install
npm run sync
npm run dev   # http://localhost:3030
npm run build
```

Do not edit generated files under `content/` or `public/vendor/`.
