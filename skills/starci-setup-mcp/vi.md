---
title: starci-setup-mcp
---

# starci-setup-mcp

## LOADS

| Alias | Đích | Loại | Lý do |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | contract approval và output dùng chung |
| `@workspaces` | `contexts/workspaces` | module | resolve và xác minh mọi project/role được yêu cầu |
| `@mcp` | `mcp` | module | contract Qdrant, index và publication toàn Source |
| `@embedding` | `mcp/embedding` | module | cài Ollama và chọn model theo phần cứng |
| `@clients` | `mcp/clients` | module | cài client Codex/OpenAI và Claude Code |
| `@source-context` | `scripts/qdrant-source-context.mjs` | script | setup Docker và refresh partition deterministic |
| `@tunnel-set` | `scripts/cloudflare-tunnel-set.mjs` | script | reconcile tunnel và DNS mà không lộ value |

## NESTED SKILLS

Không có.

## Chạy

Đọc `@skill-shape`, `@workspaces`, `@mcp` và `@embedding` trước khi resolve ngôn ngữ Source, project cùng đúng các role từ
`.workspace/<project>/<role>/config.json`. Không suy đoán
checkout và không clone repository: “lấy source StarCi” nghĩa là đọc checkout đã được route khai báo. Route
thiếu hoặc stale thì dừng.

Trước lần setup đầu tiên, đo RAM, CPU, GPU/VRAM và trạng thái `ollama list` / `ollama ps`; tư vấn đúng một
embedding tier từ `@embedding` và giải thích đánh đổi latency/chất lượng. Khi model chưa có, cài Ollama và chỉ
pull model embedding đã chọn. Xác minh capability, embedding length gốc, một response `/api/embed` và tỷ lệ
CPU/GPU thực tế. Không đoán dimension từ tên model.

Chạy `@source-context plan`, rồi `setup`, cho các role đã chọn. Một Source chỉ có một Qdrant, một MCP runtime
và một collection; project thêm vào chỉ tạo partition `/<role>/<project>/`. MCP luôn read-only và chỉ publish
source catalog. Việc đọc source trực tiếp vẫn là thẩm quyền.

## DNS và credential

Tên thư mục đúng là số ít: `.workspace/credentials/`, không phải `.workspaces/credentials/`. Tái sử dụng các
SOPS ciphertext sau qua machine identity đã khởi tạo; không in hoặc sao chép plaintext:

- `cloudflare-api-token.key.enc` — quyền reconcile Cloudflare dùng chung toàn Source;
- `cloudflare-<tunnel>-tunnel-token.key.enc` — run token của connector cho named tunnel dùng chung.

Hostname mặc định là `mcp.<zone>`. Dùng `@tunnel-set` để plan chính xác hostname, tunnel và HTTP origin.
Mutation tunnel/DNS bên ngoài là biên `### NEED APPROVALS`; chỉ `OK` trên plan đã hiển thị mới cho phép
reconcile. Ingress phải merge, giữ hostname khác và terminal 404. Chỉ publish MCP HTTP origin; Qdrant
REST/gRPC và Ollama luôn private.

## Các client

Sau khi public smoke test pass, đọc `@clients` và cấu hình cả Codex/OpenAI lẫn Claude Code bằng cùng endpoint
chuẩn. Merge `~/.codex/config.toml` cho Codex và dùng `claude mcp add --transport http --scope user` cho
Claude Code. Endpoint localhost chỉ dùng cho health check. Không chuyển client nào sang URL public trước khi
MCP initialize và `tools/list` chạy thành công tại đó.

## Proof

Chứng minh route còn fresh, Docker healthy, đúng point count từng partition, chỉ có tool read-only, semantic
search trả về path `/<role>/<project>/`, public HTTPS MCP smoke pass, cả Codex và Claude Code connected,
ciphertext credential tồn tại và không có plaintext twin. Chỉ báo tên cùng verdict; không bao giờ báo
credential value.
