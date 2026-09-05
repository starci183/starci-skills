# @starci/skills

StarCi Skills là runtime `.claude` của một repository: một cửa vào (`SKILL.md`), các operator có ranh giới rõ,
workflow được lập từ goal đã xác nhận, một bản đồ routing đóng và một sổ tool. Agent trong Claude Code hay Codex đọc
`.claude/INDEX.md` qua một đoạn bootstrap ngắn rồi theo đúng thứ tự nạp của nó; phần còn lại là việc của
cây. Tài liệu: <https://harness.starci.org/docs/vi>. Bản tiếng Anh là thẩm quyền khi chạy: [README.md](README.md).

## Cài đặt

```bash
npx @starci/skills init
```

Chạy ở gốc repository sẽ sở hữu runtime. Mọi prompt vào StarCi; follow-up giữ cùng host session. Lệnh chép cây vào `./.claude`, viết `CLAUDE.md` (Claude Code
đọc) và `AGENTS.md` (Codex đọc) khi chưa có, và thêm `.worktrees/sessions/` vào `.gitignore` vì phiên
làm việc nằm ở đó. Hãy commit `.claude/` cùng repository: nó là source, không phải cache. Cần Node 20
trở lên; CLI không có dependency. Cùng CLI đó chạy thẳng từ nhánh Git khi registry chưa liệt kê phiên bản:

```bash
npx --package=github:starci183/starci-skills#main starci-skills init
```

| Lệnh | Việc nó làm |
| --- | --- |
| `npx @starci/skills init [--dir <repo>] [--force] [--no-bootstrap]` | Cài cây và hai bootstrap. Từ chối một `.claude` đã có sẵn mà không do nó cài, trừ khi `--force`, và kể cả khi đó cũng chỉ thay các đường dẫn runtime. |
| `npx @starci/skills update [--dir <repo>] [--force] [--no-bootstrap]` | Nâng cây đã cài lên phiên bản của gói. File đã sửa tay được giữ lại và liệt kê; `--force` lấy bản của gói. File ngoài các đường dẫn runtime không bao giờ bị đụng. |
| `npx @starci/skills doctor [--dir <repo>] [--quick]` | Chạy chính bộ validator của cây trên bản đã cài (routing, alias, operator, workflow, mặc định, template, trích dẫn knowledge, self-test của operator và helper, và spec của script) và báo những file đã đổi từ lúc cài. |
| `npx @starci/skills version` | In phiên bản gói. |

Các đường dẫn runtime là `UPDATE.md`, `UPDATE.vi.md`, `INDEX.md`, `INDEX.vi.md`, `SKILL.md`, `SKILL.vi.md`, `routing.json`,
`alias/`, `helpers/`, `knowledge/`, `operators/`, `readiness/`, `resources/`, `scripts/`, `templates/`,
`workflows/`. Manifest `.claude/.starci-skills.json` ghi phiên bản đã cài và hash từng file; `update` và
`doctor` đọc nó.

## Claude Code và Codex

Hai runtime vào cùng một cửa. `CLAUDE.md` và `AGENTS.md` mang cùng một đoạn bootstrap: đọc trọn
`.claude/INDEX.md` và theo thứ tự nạp của nó. Processor chạy từng operator trên profile mà
`operator.json` của nó ràng (`resources/agents/profiles/openai.json` cho Codex, `claude.json` cho Claude
Code, ghép cặp trong `resources/orchestrator.json`), và mỗi operator chỉ được gọi những tool mà
`operator.json` của nó khai từ `resources/tools.json`. File tiếng Anh là thẩm quyền khi chạy; bản `.vi.md`
dành cho người đọc.

## Phiên làm việc 2.2

Session thuộc task/worktree của Codex hoặc session của Claude. Agent con là worker trong phiên đó.
[SKILL.md](SKILL.md) dẫn prompt qua bản nháp scope có bảng goal, kết quả mong đợi và ví dụ;
chỉ xác nhận còn thiếu mới cần hỏi. Workflow được dựng lại từ goal và kết quả có kiểu.

Trước mỗi thao tác, runtime khóa expected, input và môi trường. Sau đó validator đối chiếu actual
với bằng chứng; sai thì giao đúng owner sửa rồi chạy attempt mới, giữ lịch sử cũ.
[orchestrator.json](resources/orchestrator.json) sở hữu giới hạn tối đa 3 worker và cách cô lập tài nguyên.
Thành công được đóng bằng script lifecycle, giữ compact cùng bundle có hash tại
`.worktrees/done/` trước khi xóa riêng thư mục session. Phiên chưa xong được giữ để tiếp tục.

Profile suy luận và đánh giá là Sol/Fable; profile thực thi là Sol/Opus. Cùng model Sol vẫn có context
và quyền riêng cho từng vai trò. [Tài nguyên](resources/INDEX.vi.md) liệt kê assignment thực tế.
Quy trình UI ràng buộc toàn bộ knowledge đã áp dụng, phân tích family Grammar trước khi sửa và
đánh giá cả thẩm mỹ trên bản render. `knowledge.repair` và `library.update` sở hữu hai loại sửa tương ứng.

## Phát triển

Repository này chính là gói. `npm test` chạy mọi validator, self-test của operator, spec của script và
kiểm tra docs; `docs/` là site Nextra và `sites/skills` là landing, cả hai không nằm trong gói.
