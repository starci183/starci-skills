---
title: Grammar frontend tất định Tây Sơn · Tiếng Việt
---

# Grammar frontend Tây Sơn

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@grammar` | `grammars/tayson/grammar.json` | file | rule đóng cho public và CRM |
| `@facts` | `grammars/tayson/facts.json` | file | catalog fact quan sát được |
| `@capsules` | `grammars/tayson/capsules.json` | file | behavior bền vững cùng binding case/template |
| `@rulings` | `grammars/tayson/rulings.json` | file | owner statement có negative boundary |
| `@master-system` | `grammars/tayson/design-system.json` | file | một hệ thương hiệu Tây Sơn dùng cho public và CRM |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | resolver tất định |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | proof package, case, hash và template |

## Record

Package này là UI grammar độc lập của product family Tây Sơn. Nó bao phủ website công khai và CRM/CMS xác thực trong một profile vì cả hai cùng sản phẩm và thương hiệu; fact bề mặt quan sát được giữ composition và density của chúng tách biệt.

## Law

1. `TAYSON-GRAMMAR-1` — Route đã verify chọn grammar `tayson` và profile `tayson`; profile StarCi không bao giờ thay authority Tây Sơn.
2. `TAYSON-GRAMMAR-2` — Bề mặt public dùng owner biên tập của public site; CRM xác thực dùng owner operational shell, collection và form.
3. `TAYSON-GRAMMAR-3` — Public và CRM dùng chung topology token, logo và nhận diện xanh Tây Sơn nhưng không dùng chung page anatomy.
4. `TAYSON-GRAMMAR-4` — Website public không trở thành member portal; CRM chỉ gồm capability quản trị nội bộ đã được duyệt.
5. `TAYSON-GRAMMAR-5` — Feature state nằm trong chain Page/Block của app sở hữu; shared UI package không giữ product request state.

## Routing

`apps/web` resolve fact public. `apps/crm` resolve fact operational đã xác thực. Cả hai có thể reuse leaf và branch từ `packages/ui`, còn page và business block nằm trong app sở hữu.

## Rules

1. Product identity dùng chung; surface intent không dùng chung.
2. Typography biên tập của public và density vận hành của CRM là hai outcome riêng.
3. CRM bắt buộc permission-aware state tại mọi operation có role gate.
4. Sales, payment, ticket hoặc member portal mới phải có business authority mới trước khi promote grammar.

## Stops

- Workspace route chọn grammar hoặc profile khác.
- Region public resolve sang CRM owner hoặc region CRM xác thực resolve sang public owner.
- Capability CRM được yêu cầu chưa có trong business authority.

## Output

Chỉ trả fact, outcome, behavior capsule, template, principle concern Tây Sơn đã chọn cùng deterministic receipt.
