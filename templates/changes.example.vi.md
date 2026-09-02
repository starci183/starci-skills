# Thay đổi — `fe.source.apply` · `invocation-a3-continue-learning-2`

Đây là ví dụ mẫu mà khuôn được ép lên. Nó mô tả thứ một bước `fe.source.apply` sẽ ghi sau khi
`fe.presentation.resolve` đã resolve `dashboard/ContinueLearning`: hai file trong checkout frontend,
chưa commit, một receipt nằm cạnh bản ghi này.

## Ràng buộc

| Trường | Giá trị |
| --- | --- |
| Operator | `fe.source.apply` |
| Invocation | `invocation-a3-continue-learning-2` |
| Receipt | `@dynamic/fe-source-application.json` |
| Checkout | `@workspaces/fe` ở `14e0c20f` → chưa commit |
| Bước trước | `@dynamic/fe-presentation-resolution.json` |

## File

| Đường dẫn | Thay đổi | Vì sao | Claim |
| --- | --- | --- | --- |
| `src/components/blocks/dashboard/ContinueLearning/classNames.ts` | sửa | lưới bộ sưu tập resolve về GAP-4 Case 2, thay `gap-2` | GAP-4 |
| `src/components/blocks/dashboard/ContinueLearning/component.tsx` | sửa | cặp danh tính mang claim trên cột do app sở hữu | GAP-1 |
| `src/components/blocks/dashboard/ContinueLearning/component.spec.tsx` | không đổi | không assertion nào gọi tên class | — |

## Bước kế tiếp cần biết gì

- Cổng cần chạy: `lint:check`, `typecheck`, `test:unit` giới hạn trong `blocks/dashboard/ContinueLearning`.
- Bề mặt cần soi: route dashboard ở `md` và `xl`, thẻ tiếp tục học ở trạng thái `ready` và `pending`.
- Không đổi có chủ đích: `index.tsx`, vì export công khai và props của block không dịch chuyển.
