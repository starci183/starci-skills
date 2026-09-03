# @starci/skills

StarCi Skills là runtime `.claude` của một repository: một cửa vào (`SKILL.md`), mười bốn operator, tám
workflow ví dụ, một bản đồ routing đóng và một sổ tool. Agent trong Claude Code hay Codex đọc
`.claude/INDEX.md` qua một đoạn bootstrap ngắn rồi theo đúng thứ tự nạp của nó; phần còn lại là việc của
cây. Tài liệu: <https://harness.starci.org/docs/vi>. Bản tiếng Anh là thẩm quyền khi chạy: [README.md](README.md).

## Cài đặt

```bash
npx @starci/skills init
```

Chạy ở gốc repository sẽ sở hữu runtime. Lệnh chép cây vào `./.claude`, viết `CLAUDE.md` (Claude Code
đọc) và `AGENTS.md` (Codex đọc) khi chưa có, và thêm `.worktrees/sessions/` vào `.gitignore` vì phiên
làm việc nằm ở đó. Hãy commit `.claude/` cùng repository: nó là source, không phải cache. Cần Node 20
trở lên; CLI không có dependency.

| Lệnh | Việc nó làm |
| --- | --- |
| `npx @starci/skills init [--dir <repo>] [--force] [--no-bootstrap]` | Cài cây và hai bootstrap. Từ chối một `.claude` đã có sẵn mà không do nó cài, trừ khi `--force`, và kể cả khi đó cũng chỉ thay các đường dẫn runtime. |
| `npx @starci/skills update [--dir <repo>] [--force]` | Nâng cây đã cài lên phiên bản của gói. File đã sửa tay được giữ lại và liệt kê; `--force` lấy bản của gói. File ngoài các đường dẫn runtime không bao giờ bị đụng. |
| `npx @starci/skills doctor [--dir <repo>] [--quick]` | Chạy chính bộ validator của cây trên bản đã cài (routing, alias, operator, workflow, mặc định, template, trích dẫn knowledge, self-test của operator và spec của script) và báo những file đã đổi từ lúc cài. |
| `npx @starci/skills version` | In phiên bản gói. |

Các đường dẫn runtime là `INDEX.md`, `INDEX.vi.md`, `SKILL.md`, `SKILL.vi.md`, `routing.json`,
`alias/`, `knowledge/`, `operators/`, `readiness/`, `resources/`, `scripts/`, `templates/`,
`workflows/`. Manifest `.claude/.starci-skills.json` ghi phiên bản đã cài và hash từng file; `update` và
`doctor` đọc nó.

## Claude Code và Codex

Hai runtime vào cùng một cửa. `CLAUDE.md` và `AGENTS.md` mang cùng một đoạn bootstrap: đọc trọn
`.claude/INDEX.md` và theo thứ tự nạp của nó. Processor chạy từng operator trên profile mà
`operator.json` của nó ràng (`resources/agents/profiles/openai.json` cho Codex, `claude.json` cho Claude
Code, ghép cặp trong `resources/orchestrator.json`), và mỗi operator chỉ được gọi những tool mà
`operator.json` của nó khai từ `resources/tools.json`. File tiếng Anh là thẩm quyền khi chạy; bản `.vi.md`
dành cho người đọc.

## Phát triển

Repository này chính là gói. `npm test` chạy mọi validator, self-test của operator, spec của script và
kiểm tra docs; `docs/` là site Nextra và `sites/skills` là landing, cả hai không nằm trong gói.
