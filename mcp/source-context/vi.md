---
title: Ngữ cảnh source theo route
---

# Ngữ cảnh source theo route

## Projection

Mỗi role được resolve từ `.workspace/<project>/<role>/config.json` và publish virtual path dưới
`/<role>/<project>/` trong collection dùng chung `starci-context-v1`. Refresh upsert một generation rồi chỉ
xóa point cũ của đúng partition role/project đó; source khác không bị chạm.

Mỗi tracked source file được đại diện trong catalog theo feature/module bằng virtual path và source outline:
import, export, decorator, class, function và declaration. Search dẫn agent tới file thẩm quyền thay vì trả
về implementation fragment rời rạc. Dependency, dữ liệu VCS, build output, coverage, cache, stack data,
environment file và lockfile đều bị loại.

Payload cố ý khớp với Qdrant MCP server chính thức:

```json
{"document":"<catalog dưới /role/project>","metadata":{"project":"...","role":"...","paths":["/role/project/..."]}}
```

Vector dùng tên `ollama-qwen3-embedding-8b`. Cả lúc index lẫn lúc MCP query đều gọi model Ollama có sẵn
`qwen3-embedding:8b` với 4096 chiều. Server chính thức vẫn là lõi MCP/Qdrant; một adapter
`EmbeddingProvider` nhỏ nối Ollama vì upstream hiện chỉ phát hành FastEmbed.

## Biên publish

Pattern endpoint remote chuẩn là `https://mcp.<zone>/mcp`; endpoint chẩn đoán local là
`http://localhost:8011/mcp`. Cloudflare đưa hostname qua tunnel remotely managed dùng chung
`starci-local-services` tới `http://host.docker.internal:8011`. Chỉ MCP được publish: Qdrant REST, Qdrant
gRPC và Ollama không bao giờ là tunnel origin.

Hai record control-plane toàn Source là
`.workspace/credentials/cloudflare-api-token.key.enc` và
`.workspace/credentials/cloudflare-starci-local-services-tunnel-token.key.enc`. Chúng luôn là SOPS
ciphertext cục bộ theo máy. Reconcile phải merge hostname này vào ingress sẵn có và giữ catch-all 404;
không được thay thế service khác trên tunnel dùng chung.

## Lệnh

- `plan` resolve route, chủ stack, collection và prerequisite mà không ghi.
- `config` ghi Compose, environment và client JSON cục bộ vào `.worktrees/source-context/cache/mcp/`; truyền
  `--public-url https://mcp.<zone>/mcp` khi Source không dùng StarCi zone mặc định.
- `index` chạy indexer bằng container, tải embedding model nếu máy chưa có, dựng các projection và ghi manifest không chứa giá trị bên
  cạnh client JSON.
- `setup` chạy config, khởi động Qdrant, index rồi khởi động MCP đúng thứ tự; `down` chỉ dừng stack này.

Cấu hình client Codex/OpenAI:

```toml
[mcp_servers.starci-source-context]
url = "https://mcp.<zone>/mcp"
```

Cài cấu hình user scope cho Claude Code bằng:

```text
claude mcp add --transport http --scope user starci-source-context https://mcp.<zone>/mcp
```

Không chạy `index` lên alias thiếu prefix `starci-context-`. Không bật MCP store tool cho source collection.
