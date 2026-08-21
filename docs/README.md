# StarCi Skills Docs — Nextra

Nextra auto-discovers shared gate modules under `.claude/fe/gates/` and links deterministic project
grammars under `.claude/grammars/<grammar>/`. Product choices are not published as shared senses.

```text
<concept>/
├─ INDEX.md   # compact English rules for AI
├─ prompt.md  # plain request → semantic className reasoning
├─ vi.md      # Vietnamese human guide
├─ example.md # generic scenarios + UI/Code tabs
├─ audit.md   # advisory critique
└─ changelog.md # version history
```

Grammar projects publish their schema, rules, owner profile and golden cases. The generated
`content/` directory is ignored; run the sync command after changing a source record.

```bash
cd .claude/docs
npm install
npm run sync
npm run dev   # http://localhost:3030
npm run build
```

Do not edit generated files under `content/` or `public/vendor/`.
