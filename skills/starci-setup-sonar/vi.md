# starci-setup-sonar

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/vi.md` | vi | hợp đồng phê duyệt và đầu ra dùng chung |
| `@workspaces` | `contexts/workspaces/vi.md` | vi | xác định mọi vai trò Source đã route |
| `@assurance-be` | `compilers/patterns/be/delivery-assurance/vi.md` | vi | bằng chứng scanner, coverage và quality |
| `@assurance-fe` | `compilers/patterns/fe/delivery-assurance/vi.md` | vi | bằng chứng frontend scanner, coverage và quality |
| `@sonar-assurance` | `machines/sonar-assurance/vi.md` | vi | máy gate nghiêm ngặt và ranh giới secret |
| `@tunnel-set` | `scripts/cloudflare-tunnel-set.mjs` | script | reconcile hostname tường minh, an toàn giá trị |

## NESTED SKILLS

None.

## Run

Xác minh mọi row route Source (`be`/backend, `fe`/frontend và console) rồi kiểm kê project. Dùng một Sonar service
`compose:starci` dùng chung với project key riêng. Nạp assurance để analysis dùng unit run và coverage
artifact đã đo. Plan chỉ local và không có giá trị nhạy cảm; chỉ execute tường minh mới reconcile
provider hoặc công bố hostname.

## Authority and secrets

Scanner token theo project và khác authority admin/operator. Analysis token dùng `SONAR_TOKEN` hoặc stdin; Execute cần `SONAR_ADMIN_TOKEN`. Token không qua argument hay log; thiếu status, SHA hoặc metric bắt buộc là fail. Plan và test không gọi bên ngoài.

## Proof

Chứng minh đủ route, analysis SHA chính xác, gate OK, required findings bằng không, rating A, hotspots
đã xem 100%, duplicated density không quá 3, native coverage tối thiểu 80% tổng thể và 90% phần mới.

## Stops

- Dừng khi thiếu role, SHA thiếu hoặc lệch, required metric thiếu/lỗi, thiếu authority hoặc mở rộng phạm vi.

## Output

Báo cáo inventory, mode, bằng chứng, đường dẫn thay đổi và lệnh proof tập trung theo ngôn ngữ workspace.
