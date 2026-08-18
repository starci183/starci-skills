---
title: starci-setup-sonar
---

# starci-setup-sonar

## LOADS

| Alias | Đích | Loại | Lý do |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | contract approval và output dùng chung |
| `@workspaces` | `contexts/workspaces` | module | resolve backend sở hữu stack và project đích |
| `@assurance-be` | `compilers/patterns/be/delivery-assurance` | module | contract scanner, token, coverage và quality gate |
| `@tunnel-set` | `scripts/cloudflare-tunnel-set.mjs` | script | reconcile tunnel và DNS mà không lộ value |

## NESTED SKILLS

Không có.

## Chạy

Đọc `@skill-shape`, `@workspaces` và `@assurance-be`. Resolve route đã xác minh sở hữu file của shared
StarCi stack, nhưng chạy SonarQube, PostgreSQL, bootstrap cùng connector dưới Docker Compose project `starci`,
không nằm trong product Compose group. Dùng command `compose:starci` và tái sử dụng service dùng chung;
không tạo một SonarQube cho từng project. Mỗi project có `sonar.projectKey` riêng và CI `SONAR_TOKEN` riêng;
coverage phải đến từ cùng measured unit run mà Codecov dùng.

## DNS và credential

Cloudflare control-plane toàn Source nằm tại `.workspace/credentials/` (số ít). Tái sử dụng
`cloudflare-api-token.key.enc` và `cloudflare-<tunnel>-tunnel-token.key.enc` qua SOPS mà không in plaintext.
SonarQube admin, database và scanner token do product sở hữu vẫn nằm trong encrypted stack record đã duyệt;
Cloudflare credential không được chuyển vào CI secret của product repository.

Hostname mặc định là `sonar.<zone>`. Dùng `@tunnel-set` để plan chính xác hostname, shared tunnel và SonarQube
HTTP origin. Mutation tunnel/DNS bên ngoài cần plan `### NEED APPROVALS` đã hiển thị và `OK`. Reconcile phải
merge route này mà không xóa MCP hoặc ingress khác.

## Proof

Chứng minh mọi container healthy, default admin password SonarQube đã được thay, public system status truy cập
được, project key không trùng, scanner analysis được nhận, quality gate hoàn tất, encrypted credential record
tồn tại và không plaintext credential nào bị track hoặc in. Dashboard chạy chưa đủ thành assurance của project;
CI vẫn phải enforce scanner và kết quả quality gate.
