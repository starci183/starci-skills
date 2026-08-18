---
title: Ngữ cảnh MCP
---

# Ngữ cảnh MCP

## LOADS

| Alias | Đích | Dùng khi |
|---|---|---|
| `@mcp-qdrant` | `mcp/qdrant` | chuẩn bị hoặc kiểm tra dịch vụ vector cục bộ và runtime MCP |
| `@mcp-embedding` | `mcp/embedding` | đo phần cứng, cài Ollama và chọn một embedding profile đã khóa dimension |
| `@mcp-source-context` | `mcp/source-context` | lập chỉ mục một hay nhiều role workspace đã xác minh và sinh cấu hình client |
| `@mcp-clients` | `mcp/clients` | cài endpoint remote đã xác minh vào cả Codex/OpenAI và Claude Code |

## Mục đích

Cung cấp ngữ cảnh semantic bổ sung mà không biến cơ sở dữ liệu vector thành nguồn thẩm quyền. Workspace
route vẫn quyết định vị trí source; Git vẫn quyết định nội dung source; Qdrant chỉ là projection có thể dựng lại.

## Quy tắc

- Resolve `.workspace/<project>/<role>/config.json` trước khi đọc checkout.
- Dùng một Qdrant instance và collection cho toàn Source. Chia partition bằng virtual root
  `/<role>/<project>/`; thêm project không tạo thêm Qdrant hay MCP container.
- Cấu hình và manifest sinh ra nằm trong `.worktrees/source-context/cache/mcp/`, không nằm trong cây này.
- MCP source-context chạy read-only. Chỉ indexer deterministic được refresh dữ liệu.
- Credential được đọc từ file plaintext đã gitignore của backend route sau `npm run sync`; không sao chép giá
  trị vào MCP JSON, argument, output hay file tracked.
- Dùng `https://mcp.<zone>/mcp/` làm endpoint chuẩn cho client của zone đã chọn. Chỉ giữ
  `http://localhost:8011/mcp/` để health check và phục hồi trên chính máy chạy stack.
- Chỉ publish cổng HTTP của MCP qua tunnel Cloudflare remotely managed dùng chung
  `starci-local-services`. Cổng Qdrant và Ollama API luôn private.
- Cloudflare API token và tunnel run token chỉ thuộc các SOPS ciphertext trong
  `.workspace/credentials/`. Connector có thể đọc runtime file đã giải mã, nhưng token không được đi vào
  cây trust này, client JSON, Compose argument hay log.
- Dựng lại context khi route hoặc revision mong muốn thay đổi. Kết quả tìm kiếm chỉ là evidence bổ sung,
  không cho phép bỏ qua việc đọc source trực tiếp trước khi ghi.

## Entry point

```text
node .claude/scripts/qdrant-source-context.mjs plan   --project <project> --roles be,fe
node .claude/scripts/qdrant-source-context.mjs setup  --project <project> --roles be,fe
```

Client record sinh ra dùng `https://mcp.<zone>/mcp/` đã cấu hình. Trước khi publish, operator kiểm tra endpoint
local; sau đó reconcile hostname đó tới `http://host.docker.internal:8011` qua tunnel dùng chung. Với Source
này, `<zone>` là `starci.org`.

Đọc `@mcp-embedding`, rồi `@mcp-qdrant`, khi setup máy lần đầu; đọc `@mcp-source-context` cho contract lập
chỉ mục và chỉ đọc `@mcp-clients` sau khi public smoke pass.
