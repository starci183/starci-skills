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

## Showcase public

Stack được sinh còn chạy một proxy showcase Nginx riêng ở cổng localhost 8012. Route chuẩn là
`https://qdrant.<zone>/dashboard`, được suy ra từ endpoint `https://mcp.<zone>/mcp/` đã chọn trừ khi có URL
showcase được truyền rõ. Tunnel Cloudflare dùng chung trỏ vào proxy, không bao giờ trỏ vào
cổng REST/gRPC của Qdrant. Proxy chỉ inject key chuyên dụng trên hop upstream private, cho phép GET để xem
và các endpoint truy vấn vector chỉ-đọc mà dashboard khai báo rõ, đồng thời từ chối mọi method và endpoint
ghi. Key không đi tới cấu hình browser, HTML, JavaScript, URL hay log.

Showcase là evidence để trình bày, không phải bề mặt quản trị. Operator tiếp tục dùng
`http://localhost:<dedicated-rest-port>/dashboard` để quản trị private. Muốn thêm collection hoặc thao tác
đọc vào allowlist public phải qua một thay đổi proxy được review; không mở rộng sang origin Qdrant raw cho
tiện.

## Dừng và phục hồi

Dừng stack riêng bằng `node .claude/scripts/qdrant-source-context.mjs down --project <project> --roles
be,fe`. Context có thể dựng lại: chạy lại index để chỉ thay các partition
`/<role>/<project>/` đã chọn. Partition của project khác không bị chạm.
