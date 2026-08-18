---
title: Cài MCP vào client
---

# Cài MCP vào client

## Luật dùng chung

Cấu hình cả hai client sau khi public MCP smoke pass. Dùng cùng server name `starci-source-context` và cùng
endpoint `https://mcp.<zone>/mcp`. URL localhost chỉ là fallback chẩn đoán trên máy chạy Docker. Không ghi
Cloudflare, Qdrant hoặc Ollama credential vào config của bất kỳ client nào.

## Codex và client desktop OpenAI

Codex lưu MCP tại `~/.codex/config.toml`; ChatGPT desktop app, Codex CLI và Codex IDE extension dùng chung
file này. Merge table sau mà không thay setting khác của user:

```toml
[mcp_servers.starci-source-context]
url = "https://mcp.<zone>/mcp"
required = true
enabled_tools = ["qdrant-find"]
```

Parse TOML sau khi ghi. Restart desktop app hoặc IDE extension, rồi kiểm tra bằng `codex mcp list` và `/mcp`.
Server phải initialize và chỉ expose `qdrant-find`. ChatGPT web không đọc config Codex cục bộ; muốn dùng MCP
này trong hosted ChatGPT phải publish plugin riêng, nằm ngoài bước cài client này.

## Claude Code

Cài cùng remote Streamable HTTP server ở user scope để dùng được trong mọi project của chủ máy:

```text
claude mcp add --transport http --scope user starci-source-context https://mcp.<zone>/mcp
claude mcp get starci-source-context
claude mcp list
```

Chạy `/mcp` trong Claude Code và yêu cầu server hiện connected. User scope được lưu trong `~/.claude.json`;
không sửa tay hoặc thay cả file khi CLI dùng được. Chỉ dùng project scope khi team chủ động muốn root
`.mcp.json` được version-control; server project scope cần workspace trust và interactive approval.

## Idempotency và proof

Đọc entry hiện có trước khi thêm. Nếu cùng name đã trỏ đúng endpoint được duyệt thì giữ nguyên. Nếu khác,
báo URL cũ và mới không chứa secret trước khi thay. Chỉ hoàn tất khi cả hai client connect, chỉ list read tool
và trả semantic result có route `/<role>/<project>/`. Browser GET không phải MCP health test; Streamable HTTP
chờ MCP protocol request và có thể từ chối navigation bình thường.
