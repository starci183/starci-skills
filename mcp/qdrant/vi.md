---
title: Setup Qdrant MCP
---

# Setup Qdrant MCP

## Quyền sở hữu

Lớp MCP sở hữu Qdrant container, volume và `qdrant-mcp-api-key.txt.enc` riêng trong backend stack đã xác
minh. Nó không dùng chung trạng thái với Qdrant nghiệp vụ.

## Máy mới

Từ Source:

```text
node .claude/scripts/qdrant-source-context.mjs setup --project <project> --roles be,fe
```

Setup tự mint key ngẫu nhiên riêng qua `secret:set` khi chưa có, chỉ giữ ciphertext SOPS trong Git, sinh
Compose/client file cục bộ, chạy Qdrant, index các route được chọn bằng model Ollama
`qwen3-embedding:8b` có sẵn rồi chạy một MCP read-only container cho toàn Source.

## Kiểm tra

Chạy `node .claude/scripts/qdrant-source-context.mjs plan --project <project> --roles be,fe`. Kết quả phải có
route hợp lệ, port riêng, key file tồn tại và không rỗng, Docker cùng model Ollama đã nêu. Lệnh chỉ
in tên và đường dẫn, không in key.

## Runtime

Compose chạy Qdrant, các indexer deterministic one-shot và một MCP container dẫn xuất từ server chính thức. Phần
mở rộng duy nhất là Ollama embedding provider để dùng model 8B của chủ máy. Server dùng streamable HTTP và
`QDRANT_READ_ONLY=true`. Client JSON chứa URL chuẩn `https://mcp.<zone>/mcp/` và không chứa credential;
cổng localhost 8011 chỉ là bề mặt chẩn đoán cục bộ.

## Dừng và phục hồi

Dừng stack riêng bằng `node .claude/scripts/qdrant-source-context.mjs down --project <project> --roles
be,fe`. Context có thể dựng lại: chạy lại index để chỉ thay các partition
`/<role>/<project>/` đã chọn. Partition của project khác không bị chạm.
